"""
Production-Grade SRE Foundation Model Fine-Tuning Script.
Optimized for NVIDIA Blackwell B200 GPU (192GB HBM3e) & A100/H100 clusters.

Supports:
- Base Models: Qwen/Qwen2.5-7B-Instruct, Qwen/Qwen2.5-14B-Instruct, meta-llama/Llama-3.1-8B-Instruct
- LoRA / QLoRA with rank=128, alpha=256 on all linear attention projections
- Native bfloat16 mixed precision + FlashAttention-2
- Cosine learning rate schedule with warmup & gradient checkpointing
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def train(
    base_model_name: str = "Qwen/Qwen2.5-7B-Instruct",
    dataset_path: str = "data/processed/sentinel_sre_train_8k.jsonl",
    output_dir: str = "checkpoints/sentinel-sre-8b-b200",
    max_seq_length: int = 8192,
    batch_size: int = 8,
    gradient_accumulation_steps: int = 4,
    learning_rate: float = 2e-4,
    epochs: int = 3,
    use_qlora: bool = False,
):
    print("=" * 70)
    print("🚀 Sentinel-SRE Foundation Model Training Pipeline (NVIDIA B200 Optimized)")
    print("=" * 70)
    print(f"[*] Base Model       : {base_model_name}")
    print(f"[*] Training Dataset : {dataset_path}")
    print(f"[*] Output Checkpoint: {output_dir}")
    print(f"[*] Context Length   : {max_seq_length} tokens")
    print(f"[*] Effective Batch  : {batch_size * gradient_accumulation_steps}")
    print(f"[*] Precision        : bfloat16 (B200 Tensor Cores)")
    print("=" * 70)

    try:
        import torch
        from datasets import load_dataset
        from transformers import (
            AutoModelForCausalLM,
            AutoTokenizer,
            BitsAndBytesConfig,
            TrainingArguments,
        )
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer
    except ImportError as e:
        print(f"\n[!] Missing PyTorch/Transformers dependencies: {e}")
        print("Please install requirements on your B200 server:")
        print("pip install torch transformers datasets trl peft bitsandbytes accelerate flash-attn\n")
        return

    # Check GPU availability and print specs
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        gpu_mem = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        print(f"[✓] Detected GPU: {gpu_name} with {gpu_mem:.1f} GB VRAM")
    else:
        print("[!] No CUDA GPU detected. Running in CPU debug mode.")

    # 1. Load Tokenizer
    print(f"[*] Loading tokenizer for {base_model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # 2. Quantization / Precision Config
    bnb_config = None
    if use_qlora:
        print("[*] QLoRA 4-bit NormalFloat (NF4) enabled.")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

    # 3. Load Model
    print(f"[*] Loading model weights for {base_model_name}...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
        attn_implementation="flash_attention_2" if torch.cuda.is_available() else "eager",
    )

    if use_qlora:
        model = prepare_model_for_kbit_training(model)

    # 4. Configure LoRA (Rank 128 for High-Capacity Domain Adaptation)
    print("[*] Initializing LoRA adapters (Rank 128, Alpha 256)...")
    lora_config = LoraConfig(
        r=128,
        lora_alpha=256,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # 5. Load Dataset
    print(f"[*] Loading processed SRE dataset from {dataset_path}...")
    if not Path(dataset_path).exists():
        print(f"[!] Dataset file {dataset_path} not found! Run scripts/tokenize_and_clean_corpus.py first.")
        return

    dataset = load_dataset("json", data_files=dataset_path, split="train")
    print(f"[✓] Loaded {len(dataset)} training samples.")

    # 6. Training Arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        learning_rate=learning_rate,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        num_train_epochs=epochs,
        logging_steps=10,
        save_strategy="epoch",
        fp16=False,
        bf16=True,
        gradient_checkpointing=True,
        optim="adamw_torch_fused" if torch.cuda.is_available() else "adamw_torch",
        report_to="none",
    )

    # 7. SFT Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        tokenizer=tokenizer,
        args=training_args,
    )

    print("\n[⚡] Starting SRE Foundation Model Training on NVIDIA B200...")
    trainer.train()

    # 8. Save Final Model Checkpoint
    print(f"\n[✓] Training complete! Saving final LoRA adapters to {output_dir}...")
    trainer.model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    print(f"[✓] Sentinel-SRE Brain checkpoint saved successfully.")


def main():
    parser = argparse.ArgumentParser(description="Train Sentinel-SRE Foundation Model on NVIDIA B200")
    parser.add_argument("--model", type=str, default="Qwen/Qwen2.5-7B-Instruct", help="Base model name")
    parser.add_argument("--data", type=str, default="data/processed/sentinel_sre_train_8k.jsonl", help="Dataset path")
    parser.add_argument("--output", type=str, default="checkpoints/sentinel-sre-8b-b200", help="Output checkpoint dir")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size per device")
    parser.add_argument("--qlora", action="store_true", help="Use 4-bit QLoRA")
    args = parser.parse_args()

    train(
        base_model_name=args.model,
        dataset_path=args.data,
        output_dir=args.output,
        epochs=args.epochs,
        batch_size=args.batch_size,
        use_qlora=args.qlora,
    )


if __name__ == "__main__":
    main()
