"""
Unsloth QLoRA Fine-Tuning Script for Qwen2.5-Coder-14B-Instruct.

Fine-tunes the base model on deep code reasoning, stack trace debugging,
line-number root cause pinpointing, patch creation, and intent parsing.

Outputs 4-bit quantized GGUF model format ready for Ollama deployment.
"""

from __future__ import annotations

import sys

def check_environment():
    try:
        import torch
        import unsloth
        print("Environment check passed: PyTorch & Unsloth available.")
    except ImportError:
        print("[Notice] PyTorch or Unsloth not found in local environment.")
        print("   Run this script on your GPU training instance (Google Colab / RunPod / Lambda Labs).")

def train():
    try:
        from unsloth import FastLanguageModel
        from datasets import load_dataset
        from trl import SFTTrainer
        from transformers import TrainingArguments

        MAX_SEQ_LENGTH = 4096
        MODEL_NAME = "Qwen/Qwen2.5-Coder-14B-Instruct"

        print(f"🚀 1. Loading Base Model: {MODEL_NAME}...")
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name = MODEL_NAME,
            max_seq_length = MAX_SEQ_LENGTH,
            load_in_4bit = True,
        )

        print("🛠️ 2. Setting up QLoRA Adapters for Code & Reasoning Layers...")
        model = FastLanguageModel.get_peft_model(
            model,
            r = 16,
            target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
            lora_alpha = 16,
            lora_dropout = 0,
            bias = "none",
        )

        print("📊 3. Loading Training Dataset (dataset.jsonl)...")
        dataset = load_dataset("json", data_files="dataset.jsonl", split="train")

        print("🏋️ 4. Running Supervised Fine-Tuning (SFT)...")
        trainer = SFTTrainer(
            model = model,
            tokenizer = tokenizer,
            train_dataset = dataset,
            dataset_text_field = "messages",
            max_seq_length = MAX_SEQ_LENGTH,
            args = TrainingArguments(
                per_device_train_batch_size = 2,
                gradient_accumulation_steps = 4,
                warmup_steps = 5,
                max_steps = 60,
                learning_rate = 2e-4,
                fp16 = True,
                logging_steps = 1,
                output_dir = "outputs",
            ),
        )
        trainer.train()

        print("💾 5. Quantizing & Saving Model to GGUF format (q4_k_m)...")
        model.save_pretrained_gguf("sentinel-qwen14b-gguf", tokenizer, quantization_method = "q4_k_m")
        print("🎉 SUCCESS! Fine-tuned model saved in: sentinel-qwen14b-gguf/")

    except Exception as e:
        print(f"❌ Training error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_environment()
    if len(sys.argv) > 1 and sys.argv[1] == "--run":
        train()
