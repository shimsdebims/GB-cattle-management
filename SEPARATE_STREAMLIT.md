Goal: Separate the Streamlit app into its own repository/workspace so the cattle-management codebase remains focused and lightweight.

Why:
- The Streamlit app has heavy ML dependencies (torch, torchvision, etc.) that are unrelated to the cattle-management web app (Flask + React). Keeping them together increases install times and risk of dependency collisions.
- Separating makes CI, deployments, and dependency management simpler.

What this change does (non-destructive):
- Adds this file documenting recommended extraction steps and commands to move the Streamlit app to a new repository using git subtree (or manual copy).
- Adds a short note to the GB/README.md clarifying that the Streamlit app is separate/optional.

Recommended extraction steps (git subtree split method):
1. Create a new repository on GitHub (via web UI or gh/CLI). Example name: "GB-crop-disease-streamlit".

2. From the cattle-management repo root, create a branch that isolates the Streamlit folder's history:

   # Create a branch from current main (or the branch you want to split from)
   git checkout -b extract-streamlit

   # Use subtree split to get a branch with only the Streamlit folder's history
   git subtree split --prefix=Streamlit -b streamlit-only

   # Create the new remote (replace <username> and repo name)
   git remote add streamlit-remote git@github.com:<username>/GB-crop-disease-streamlit.git

   # Push the subtree branch to the new repo
   git push streamlit-remote streamlit-only:main

   # After pushing, verify the new repo contains only the Streamlit files and history.

3. Remove the Streamlit folder from this repository (optional, destructive):

   # On your main branch (or a new feature branch), remove the folder and commit
   git checkout main
   git rm -r Streamlit
   git commit -m "chore: remove Streamlit app (moved to separate repo)\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
   git push origin main

   Note: Only remove Streamlit after you have pushed and validated the new repo.

Alternative (manual copy):
- If subtree is not available or you prefer a clean history, copy the files manually into a new repository and commit there. This loses history but is simpler.

Running the cattle-management app without Streamlit:
- Backend (Flask): cd GB/backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python app.py
- Frontend (React): cd GB/frontend && npm install && npm start

If Streamlit remains in this repo but should not be installed during normal dev workflows:
- Avoid running `pip install -r requirements.txt` from the repository root. Use the backend requirements in GB/backend/requirements.txt.

Notes and next steps:
- After extraction, update top-level documentation to point to the new Streamlit repo and update any CI workflows that may have included Streamlit dependencies.
- Consider adding a small CI check in the cattle-management repo to ensure the Streamlit app is not installed by default.

Contact/verification:
- After following the subtree steps, open the new repo and verify files and history.
- Only then remove the Streamlit directory from this repo and push.

-- End of SEPARATE_STREAMLIT.md --
