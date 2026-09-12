"""
Pre-loader: Forces huggingface_hub to fully verify and cache
Qwen2.5-Coder-7B-Instruct without loading into GPU memory.
Writes a sentinel file when done so train_max_gpu.py can detect it.
"""
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

MODEL_NAME = "Qwen/Qwen2.5-Coder-7B-Instruct"
HF_TOKEN = os.getenv("HF_TOKEN", "")
READY_FLAG = "model_cache_ready.flag"

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

print("=" * 55)
print("SENTINEL — Model Cache Pre-Loader")
print(f"Model: {MODEL_NAME}")
print("=" * 55)

# Login
import huggingface_hub
huggingface_hub.login(token=HF_TOKEN, add_to_git_credential=False)
print("[*] HF auth set.")

# Use snapshot_download which handles retries much better than from_pretrained
from huggingface_hub import snapshot_download
print("[*] Starting snapshot_download (resume-capable, retry-friendly)...")

local_dir = snapshot_download(
    repo_id=MODEL_NAME,
    token=HF_TOKEN,
    ignore_patterns=["*.msgpack", "*.h5", "flax_model*", "tf_model*", "rust_model*"],
    resume_download=True,
    local_files_only=False,
)

print(f"[OK] Model fully cached at: {local_dir}")

# Write ready flag
with open(READY_FLAG, "w") as f:
    f.write(local_dir)

print(f"[OK] Flag written: {READY_FLAG}")
print("Cache pre-loading COMPLETE. You can now run train_max_gpu.py")
