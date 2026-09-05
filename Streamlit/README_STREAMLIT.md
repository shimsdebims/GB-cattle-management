Streamlit App: ML Dependency & Deployment Guide

Overview
- The Streamlit crop-disease application is a separate utility that performs image classification using a PyTorch model. It requires heavier dependencies (torch, torchvision) and a model artifact (Model/crop_disease_model.pth).

Why these dependencies are heavy
- PyTorch and torchvision are large Python packages (tens to hundreds of MBs). Installing them pulls binary wheels and may require CUDA-compatible builds for GPU acceleration.
- On CPU-only environments, pip will still download sizeable CPU wheels; installation can be slow and may fail on constrained systems.
- GPU/CUDA builds add operational complexity (matching CUDA driver versions) which is unnecessary for the cattle-management webapp.

Recommendations before extracting the Streamlit app
1. Move the Streamlit folder into a separate repository (recommended). Keep the Model files and the heavy dependencies there.
2. Use Git LFS for large model files (e.g., crop_disease_model.pth) or host models in an artifact store (S3, GCP, GitHub Releases).
3. Use a virtual environment or Docker for installing dependencies to avoid polluting developer machines.

Lightweight deployment options
- Convert model to a more portable format (ONNX or TorchScript) which may simplify serving and potentially allow smaller runtimes.
- Host the Streamlit app on a managed service such as Streamlit Cloud, Heroku (with buildpacks), or a Docker container on any cloud provider. Ensure model artifact is fetched at container startup (from LFS or object store).
- For production-grade model serving, consider separating model inference from the Streamlit UI. Serve a small model inference microservice (FastAPI + TorchServe/ONNX Runtime) and have Streamlit call it over HTTP. This allows independent scaling of the UI and model.

Security & storage
- Do NOT commit large model files directly into the new repo's Git history. Use Git LFS or external storage and fetch models during deployment.
- Secure any production model storage and use signed URLs or private buckets for access.

Quick Dockerfile (example)

FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
# fetch model at build or entrypoint; better to fetch at runtime to keep images small
COPY . /app
EXPOSE 8501
ENTRYPOINT ["streamlit", "run", "streamlit_app.py", "--server.port=8501", "--server.headless=true"]

Notes about moving forward
- After extraction, keep this repo focused on the cattle-management webapp (Flask + React). Maintain the Streamlit app in its own lifecycle and CI/CD pipeline.
- If you need the Streamlit app to remain accessible from the cattle-management project, add a small README link or include it as a submodule/subtree reference.

Model artifact checklist (before attempting to run)
- Ensure Model/crop_disease_model.pth is available either in repo via LFS or fetched from external storage.
- Ensure the environment has appropriate CPU/GPU support matching the PyTorch wheel (if you require GPU, ensure CUDA compatibility).

-- End of Streamlit dependency & deployment guide --
