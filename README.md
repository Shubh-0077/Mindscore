# 🧠 Mindscore — Mental Health Score Predictor

**Predicts a student's mental health score (0–10) from social media & lifestyle habits — powered by ML, served via FastAPI.**

![Status](https://img.shields.io/badge/model-online-brightgreen) ![Deploy](https://img.shields.io/badge/live_demo-not_yet_deployed-orange) ![Python](https://img.shields.io/badge/python-3.x-blue) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📸 Preview

| Landing | Input Form | Prediction |
|---|---|---|
| ![Landing](docs/assets/mindscore-landing.png) | ![Form](docs/assets/mindscore-form.png) | ![Result](docs/assets/mindscore-result.png) |

---

## 🎯 Why This Exists

Social media and lifestyle habits are widely linked to student wellbeing, but most analysis stops at a chart. Mindscore turns that analysis into something usable: enter your habits, get a real-time predicted wellbeing score from a trained model — not just a static report.

- **Input:** age, platform usage, sleep, study hours, stress, activity, etc.
- **Output:** 0–10 wellbeing score + qualitative label
- **Users:** students (implied by UI copy, not formally validated)

---

## ⚡ Key Features

- 🧹 Cleaned real-world data (dupes, invalid negatives, 111-category feature)
- 📊 Full EDA — distributions, correlations, outliers
- ⚙️ Leak-free `sklearn` Pipeline (split → preprocess → model)
- 🥊 3-way model comparison (Linear Regression vs. RF default vs. RF tuned)
- 🚀 FastAPI + Pydantic backend, vanilla JS frontend, live gauge UI

---

## 🛠️ Tech Stack

`Python` `pandas` `numpy` `scikit-learn` `matplotlib/seaborn` `FastAPI` `Pydantic` `Uvicorn` `HTML/CSS/JS`

---

## 📁 Repository Structure
```markdown
mindscore-mental-health-predictor/
├── README.md
├── LICENSE
├── .gitignore
├── CONTRIBUTING.md
├── requirements.txt
│
├── data/
│   └── raw/
│       └── student_social_media_and_mental_health_impact.csv
│
├── notebooks/
│   └── mental_health_score_eda_modeling.ipynb
│
├── models/
│   └── mental_health_model.pkl        # git-ignored by default — see note in README
│
├── app/
│   ├── backend/
│   │   └── main.py
│   └── frontend/
│       ├── index.html
│       ├── style.css
│       └── script.js
│
├── docs/
│   ├── project_plan.html              # renamed from ML_Project.html (planning/checklist doc)
│   └── assets/
│       ├── mindscore-landing.png
│       ├── mindscore-form.png
│       └── mindscore-result.png
│
└── reports/
    └── internal_project_review.md     # optional — see note in placement table
```


---

## 📊 Dataset

| | |
|---|---|
| **Size** | 5,000 rows × 13 cols |
| **Target** | `Mental_Health_Score` (0–10) |
| **Source** | `Kaggel` |

**Cleaning:** removed 2 dupes → clipped 1 invalid negative value → grouped 111 countries into top-10 + Other → log-transformed skewed `Study_Hours`.

---

## 🔬 Workflow

`Load → EDA → Clean → Feature Engineer → Pipeline (ColumnTransformer) → Split (70/30) → Train → Tune (RandomizedSearchCV) → Evaluate → Deploy (FastAPI + JS UI)`

**Why these choices:**
- Split *before* preprocessing → avoids leaking test data into the scaler/encoder
- `Study_Hours` log-transformed → right-skewed (skew ≈ 0.44), only column that needed it
- `Country` grouped to top-10 + Other → 111 raw categories would've exploded one-hot dimensionality

---

## 🏆 Results

| Model | R² (test) | MAE | RMSE |
|---|---|---|---|
| Linear Regression | 0.740 | 0.536 | 0.676 |
| **Random Forest (default)** ✅ | **0.878** | **0.347** | **0.464** |
| Random Forest (tuned) | 0.865 | 0.369 | 0.487 |

> 💡 Default RF beat the tuned one on test data — that's the model shipped in production. Tuning optimized CV, not test R².

---

## 🚀 Quick Start

```bash
git clone https://github.com/<your-username>/mindscore-mental-health-predictor.git
cd mindscore-mental-health-predictor
pip install -r requirements.txt

# Backend
cd app/backend && uvicorn main:app --reload

# Frontend
cd app/frontend && python -m http.server 5500
```

Visit `http://127.0.0.1:5500` → API docs at `http://127.0.0.1:8000/docs`

⚠️ Update the hardcoded model path in `main.py` to a relative path before running.


---

## 👤 Author

**Shubham Malkar** · `[LinkedIn]` · `[GitHub]` · `[Email]`

## 📄 License

[MIT](LICENSE) — dataset license unverified, confirm before reuse.
