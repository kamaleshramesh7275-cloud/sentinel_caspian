"""
Export & Merge Sentinel-SRE LoRA Adapters for High-Speed vLLM / Ollama Serving.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def merge_and_export(
    base_model_name: str = "Qwen/Qwen2.5-7B-Instruct",
    adapter_path: str = "checkpoints/sentinel-sre-8b-b200",
    output_dir: str = "models/sentinel-sre-final",
):
    print("=" * 65)
    print("🔄 Exporting & Merging Sentinel-SRE Model Checkpoint")
    print("=" * 65)

    try:
        import torch
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as e:
        print(f"[!] Missing dependencies: {e}")
        return

    print(f"[*] Loading base model: {base_model_name}...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_name, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_name,
        torch_dtype=torch.bfloat16,
        device_map="auto",
        trust_remote_code=True,
    )

    print(f"[*] Merging LoRA adapters from {adapter_path}...")
    model = PeftModel.from_pretrained(base_model, adapter_path)
    merged_model = model.merge_and_unload()

    print(f"[*] Saving standalone fused model to {output_dir}...")
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    merged_model.save_pretrained(output_dir, safe_serialization=True)
    tokenizer.save_pretrained(output_dir)

    print(f"\n[✓] Standalone model saved to: {output_dir}")
    print("\nTo serve with vLLM at 150+ tokens/sec on your B200 GPU server:")
    print(f"python -m vllm.entrypoints.openai.api_server --model {output_dir} --port 8000 --gpu-memory-utilization 0.9\n")


def main():
    parser = argparse.ArgumentParser(description="Merge LoRA and export Sentinel-SRE model")
    parser.add_argument("--base-model", type=str, default="Qwen/Qwen2.5-7B-Instruct")
    parser.add_argument("--adapter", type=str, default="checkpoints/sentinel-sre-8b-b200")
    parser.add_argument("--output", type=str, default="models/sentinel-sre-final")
    args = parser.parse_args()

    merge_and_export(args.base_model, args.adapter, args.output)


if __name__ == "__main__":
    main()
