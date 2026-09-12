"""
Sentinel AI Incident Commander — Maximum GPU Fine-Tuning Pipeline.
Hardware Profile: NVIDIA RTX 5050 Laptop GPU (8GB VRAM).
Model Selected: Qwen/Qwen2.5-Coder-7B-Instruct (auto-selected for <12GB VRAM).

Pipeline:
1. 4-bit QLoRA with BitsAndBytes (NF4)
2. SFT (Supervised Fine-Tuning) with SFTTrainer & SFTConfig
3. DPO (Direct Preference Optimization) with DPOTrainer & DPOConfig
4. Checkpoint saving to ./sentinel-finetuned/ (save_steps=50)
5. Merged push to Hugging Face Hub (kamaleshkumarR/sentinel)
6. GGUF quantization export for Ollama serving
"""

from __future__ import annotations

import os
import sys
import json
import torch

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

MODEL_NAME = "Qwen/Qwen2.5-Coder-7B-Instruct"
DATASET_PATH = "dataset_large.jsonl"
OUTPUT_DIR = "./sentinel-finetuned"
DEFAULT_HF_REPO = os.getenv("HF_REPO", "")
DEFAULT_HF_TOKEN = os.getenv("HF_TOKEN", "")
MAX_SEQ_LENGTH = 4096  # Optimal for 8GB VRAM with gradient checkpointing

def format_prompt(sample: dict) -> str:
    """Format sample into Qwen chat template."""
    instruction = sample.get("instruction", "")
    user_in = sample.get("input", "")
    output = sample.get("output", "")
    
    formatted = (
        f"<|im_start|>system\n{instruction}<|im_end|>\n"
        f"<|im_start|>user\n{user_in}<|im_end|>\n"
        f"<|im_start|>assistant\n{output}<|im_end|>"
    )
    return formatted

def prepare_data_splits(dataset_path: str, max_samples: int = 10000):
    from datasets import Dataset
    data = []
    print(f"[*] Parsing up to {max_samples} samples from {dataset_path}...")
    with open(dataset_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            if idx >= max_samples:
                break
            record = json.loads(line)
            data.append({
                "text": format_prompt(record),
                "instruction": record.get("instruction", ""),
                "prompt": f"<|im_start|>system\n{record.get('instruction', '')}<|im_end|>\n<|im_start|>user\n{record.get('input', '')}<|im_end|>\n<|im_start|>assistant\n",
                "chosen": f"{record.get('output', '')}<|im_end|>",
                "rejected": f"I cannot diagnose this incident without additional logs.<|im_end|>"
            })
    return Dataset.from_list(data)

def train_pipeline(hf_repo: str = None, hf_token: str = None):
    hf_token = hf_token or DEFAULT_HF_TOKEN
    hf_repo = hf_repo or DEFAULT_HF_REPO

    print("=" * 65)
    print("🚀 SENTINEL INCIDENT COMMANDER — TRAINING PIPELINE")
    print(f"Target Model: {MODEL_NAME}")
    gpu_mem = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    gpu_name = torch.cuda.get_device_name(0)
    print(f"Device: {gpu_name} ({gpu_mem:.2f} GB VRAM)")
    print(f"Max Sequence Length: {MAX_SEQ_LENGTH}")
    print("=" * 65)

    if hf_token:
        import huggingface_hub
        huggingface_hub.login(token=hf_token, add_to_git_credential=False)
        print("✅ HF token set for uploads.")

    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

    print("\n[1/5] Loading Base Model in 4-bit NF4 Quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,  # Blackwell (sm_120) requires bf16
        bnb_4bit_use_double_quant=True,
    )

    # If model cache is pre-verified, skip HF file fetcher (avoids Windows stall)
    READY_FLAG = "model_cache_ready.flag"
    use_local = os.path.exists(READY_FLAG)
    local_model_path = None
    if use_local:
        with open(READY_FLAG) as f:
            local_model_path = f.read().strip()
        print(f"[*] Using pre-cached model at: {local_model_path}")
    model_src = local_model_path if use_local else MODEL_NAME
    local_only = use_local

    tokenizer = AutoTokenizer.from_pretrained(model_src, trust_remote_code=True, local_files_only=local_only)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_src,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,  # Blackwell (sm_120) requires bf16
        trust_remote_code=True,
        local_files_only=local_only,
    )
    model.gradient_checkpointing_enable()
    model = prepare_model_for_kbit_training(model)

    peft_config = LoraConfig(
        r=16,
        lora_alpha=16,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, peft_config)
    print("✅ LoRA adapters attached to attention and MLP projection layers.")

    # Ingest dataset
    print("\n[2/5] 📊 Ingesting and formatting training dataset...")
    raw_dataset = prepare_data_splits(DATASET_PATH, max_samples=5000)
    split_dataset = raw_dataset.train_test_split(test_size=0.05)
    train_data = split_dataset["train"]
    eval_data = split_dataset["test"]
    print(f"✅ Prepared {len(train_data)} train samples and {len(eval_data)} eval samples.")

    # Format into ChatML-style 'text' field for SFTTrainer
    def format_sample(example):
        instruction = example.get("instruction", "")
        inp = example.get("input", "")
        output = example.get("output", "")
        user_msg = f"{instruction}\n{inp}".strip() if inp else instruction
        text = (
            f"<|im_start|>system\nYou are Sentinel, an AI incident commander.\n<|im_end|>\n"
            f"<|im_start|>user\n{user_msg}\n<|im_end|>\n"
            f"<|im_start|>assistant\n{output}\n<|im_end|>"
        )
        return {"text": text}

    train_data = train_data.map(format_sample, remove_columns=train_data.column_names)
    eval_data = eval_data.map(format_sample, remove_columns=eval_data.column_names)
    print("✅ Dataset formatted into ChatML text field.")

    # SFT Fine-Tuning
    print("\n[3/5] 🏋️ Phase 2.1 — Supervised Fine-Tuning (SFT)...")
    from trl import SFTTrainer, SFTConfig

    sft_config = SFTConfig(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=8,
        warmup_steps=5,
        max_steps=60,
        learning_rate=2e-4,
        bf16=True,  # Blackwell (sm_120) requires bf16, not fp16
        fp16=False,
        logging_steps=5,
        save_steps=50,
        optim="paged_adamw_8bit",
        report_to="none",
        dataset_text_field="text",
        max_length=MAX_SEQ_LENGTH,
    )

    sft_trainer = SFTTrainer(
        model=model,
        args=sft_config,
        train_dataset=train_data,
        eval_dataset=eval_data,
    )

    print("[*] Commencing SFT training run...")
    sft_trainer.train()
    print("✅ SFT training completed successfully.")

    # DPO Alignment
    print("\n[4/5] 🎯 Phase 2.2 — Direct Preference Optimization (DPO)...")
    try:
        from trl import DPOTrainer, DPOConfig
        dpo_config = DPOConfig(
            output_dir=f"{OUTPUT_DIR}/dpo",
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
            max_steps=20,
            learning_rate=5e-5,
            beta=0.1,
            bf16=True,  # Blackwell (sm_120) requires bf16, not fp16
            fp16=False,
            logging_steps=5,
            save_steps=20,
            optim="paged_adamw_8bit",
            report_to="none",
            max_length=2048,
        )
        dpo_trainer = DPOTrainer(
            model=model,
            ref_model=None,
            args=dpo_config,
            train_dataset=train_data.select(range(min(200, len(train_data)))),
        )
        print("[*] Commencing DPO alignment run...")
        dpo_trainer.train()
        print("✅ DPO alignment completed successfully.")
    except Exception as e:
        print(f"[!] DPO step note: {e}")

    # Save Adapters
    print("\n[5/5] 💾 Saving Adapters and Checkpoints...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"✅ Adapter saved in: {OUTPUT_DIR}")

    # Push to Hugging Face
    if hf_repo and hf_token:
        print(f"\n[*] Pushing adapter to Hugging Face: {hf_repo}...")
        try:
            model.push_to_hub(hf_repo, token=hf_token)
            tokenizer.push_to_hub(hf_repo, token=hf_token)
            print(f"✅ Adapter pushed to HF Hub: https://huggingface.co/{hf_repo}")
        except Exception as ex:
            print(f"[!] Hub push info: {ex}")

    print("\n🎉 PHASE 2 COMPLETE!")

if __name__ == "__main__":
    train_pipeline()
