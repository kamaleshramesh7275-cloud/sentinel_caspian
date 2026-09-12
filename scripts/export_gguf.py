"""
Phase 3b — GGUF Export (merged model already exists)
Skips the merge step, goes straight to:
  1. f16 GGUF via llama.cpp convert_hf_to_gguf.py
  2. Q4_K_M via llama-quantize.exe (pre-built binary)
  3. Write Modelfile
"""

import os, sys, subprocess, json, urllib.request, zipfile

MERGED_DIR = "sentinel-merged"
F16_GGUF   = "sentinel-f16.gguf"
GGUF_PATH  = "sentinel-q4_k_m.gguf"
MODELFILE  = "Modelfile"
LLAMACPP_DIR = "llama.cpp"

# ── Verify merged model exists ───────────────────────────────────────────────
if not os.path.isdir(MERGED_DIR):
    raise RuntimeError(f"Merged model not found at {MERGED_DIR}/ — run full export_gguf.py first.")
print(f"[OK] Merged model found at {MERGED_DIR}/")

# ── Step 1: Install llama.cpp requirements (numpy, sentencepiece etc.) ───────
print("\n[1/3] Installing llama.cpp convert dependencies...")
req_file = os.path.join(LLAMACPP_DIR, "requirements.txt")
if os.path.exists(req_file):
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", req_file, "-q",
                    "--extra-index-url", "https://pypi.org/simple/"], check=False)
# Also ensure sentencepiece and numpy present
subprocess.run([sys.executable, "-m", "pip", "install", "sentencepiece", "numpy", "-q"], check=False)
print("[OK] Dependencies ready.")

# ── Step 2: Convert merged HF model → f16 GGUF ──────────────────────────────
print("\n[2/3] Converting sentinel-merged → f16 GGUF...")
convert_script = None
for root, dirs, files in os.walk(LLAMACPP_DIR):
    for f in files:
        if "convert_hf_to_gguf" in f and f.endswith(".py"):
            convert_script = os.path.join(root, f)
            break
if not convert_script:
    raise FileNotFoundError("convert_hf_to_gguf.py not found in llama.cpp/")
print(f"[*] Script: {convert_script}")

if not os.path.exists(F16_GGUF):
    subprocess.run([
        sys.executable, convert_script,
        MERGED_DIR,
        "--outfile", F16_GGUF,
        "--outtype", "f16",
    ], check=True)
    print(f"[OK] f16 GGUF saved: {F16_GGUF} ({os.path.getsize(F16_GGUF)/1e9:.1f} GB)")
else:
    print(f"[SKIP] f16 GGUF already exists: {F16_GGUF}")

# ── Step 3: Download llama-quantize.exe and quantize → Q4_K_M ───────────────
print("\n[3/3] Quantizing f16 → Q4_K_M GGUF...")
QUANT_EXE = "llama-quantize.exe"

if not os.path.exists(QUANT_EXE):
    print("[*] Fetching latest llama.cpp release info...")
    with urllib.request.urlopen(
        "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest"
    ) as r:
        release = json.loads(r.read())
    tag = release["tag_name"]
    print(f"[*] Latest tag: {tag}")

    # Find Windows x64 zip (prefer non-CUDA to avoid DLL issues)
    asset_url = None
    for asset in release["assets"]:
        name = asset["name"]
        if ("win" in name.lower() and "x64" in name.lower()
                and "cuda" not in name.lower() and name.endswith(".zip")):
            asset_url = asset["browser_download_url"]
            print(f"[*] Found asset: {name}")
            break
    if not asset_url:
        # fallback to any win x64
        for asset in release["assets"]:
            name = asset["name"]
            if "win" in name.lower() and "x64" in name.lower() and name.endswith(".zip"):
                asset_url = asset["browser_download_url"]
                print(f"[*] Fallback asset: {name}")
                break

    if not asset_url:
        raise RuntimeError("Could not find Windows x64 zip in llama.cpp releases")

    zip_path = "llama-win.zip"
    print(f"[*] Downloading {asset_url} ...")
    urllib.request.urlretrieve(asset_url, zip_path)
    print("[*] Extracting llama-quantize.exe...")
    with zipfile.ZipFile(zip_path, "r") as z:
        found = False
        for member in z.namelist():
            if os.path.basename(member).lower() in ("llama-quantize.exe", "quantize.exe"):
                data = z.read(member)
                with open(QUANT_EXE, "wb") as out:
                    out.write(data)
                found = True
                print(f"[OK] Extracted: {member}")
                break
        if not found:
            print("[WARN] llama-quantize.exe not found in zip, listing contents:")
            for m in z.namelist():
                print("  ", m)
            raise RuntimeError("Could not extract llama-quantize.exe")
    os.remove(zip_path)

if not os.path.exists(GGUF_PATH):
    print(f"[*] Running: {QUANT_EXE} {F16_GGUF} {GGUF_PATH} Q4_K_M")
    subprocess.run([QUANT_EXE, F16_GGUF, GGUF_PATH, "Q4_K_M"], check=True)
    print(f"[OK] Q4_K_M GGUF: {GGUF_PATH} ({os.path.getsize(GGUF_PATH)/1e9:.1f} GB)")
else:
    print(f"[SKIP] Q4_K_M GGUF already exists: {GGUF_PATH}")

# ── Write Modelfile ──────────────────────────────────────────────────────────
print("\n[4/4] Writing Modelfile...")
gguf_abs = os.path.abspath(GGUF_PATH).replace("\\", "/")
modelfile_content = f"""FROM {gguf_abs}

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1
PARAMETER num_ctx 4096
PARAMETER stop "<|im_end|>"

SYSTEM \"\"\"You are Sentinel, an AI Incident Commander. You analyze production incidents, identify root causes, suggest remediation steps, and coordinate response actions with precision and speed. Always respond in structured JSON when asked for incident analysis.\"\"\"
"""
with open(MODELFILE, "w") as f:
    f.write(modelfile_content)
print(f"[OK] Modelfile written.")

print("""
=================================================================
PHASE 3 COMPLETE - GGUF Export Done!
=================================================================
Run these commands to load into Ollama:
  ollama create sentinel -f Modelfile
  ollama run sentinel
=================================================================
""")
