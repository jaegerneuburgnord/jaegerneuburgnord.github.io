import onnx

try:
    model_path = "models/sam_vit_b_01ec64.decoder.onnx"
    model = onnx.load(model_path)
    print("ONNX model loaded successfully. No parse errors encountered.")
except Exception as e:
    print(f"Failed to load ONNX model.\nException: {e}")