# Credit Card Fraud Detection System

A complete machine learning engineering project: from raw data to a deployed, interactive fraud detection dashboard — built to demonstrate the full pipeline, not just a trained model.

## 🔗 Live Demo

Try it here: **[https://creditcard-fraud-detection--sobiaasif370.replit.app/frontend/index.html](https://creditcard-fraud-detection--sobiaasif370.replit.app/frontend/index.html)**

- Dashboard: `/frontend/index.html`
- API health check: `/health`

> Note: hosted on Replit's free tier — if the app has been idle, the first request may take a few seconds to wake up.

## Screnshoots

<img width="1335" height="645" alt="Capture" src="https://github.com/user-attachments/assets/dc189216-14c8-4e3d-a141-0dfb284c2fbf" />

<img width="1340" height="645" alt="Capture2" src="https://github.com/user-attachments/assets/1e3227c0-9ab4-4d3c-8a64-9ca79cc65d50" />

<img width="1337" height="642" alt="Capture3" src="https://github.com/user-attachments/assets/841443dc-0d6e-4c56-accd-0ff56e166bed" />

<img width="1328" height="639" alt="Capture5" src="https://github.com/user-attachments/assets/d5cc33f0-8807-4f24-b4d2-ce8f8c88d6c8" />

## Overview

This project detects fraudulent credit card transactions using a highly imbalanced real-world dataset. It goes beyond training a model in a notebook — it includes a FastAPI backend, SHAP-based explainability, an adjustable detection threshold, batch prediction, live transaction monitoring, and a deployed dashboard.

**Dataset:** [Credit Card Fraud Detection](https://www.kaggle.com/mlg-ulb/creditcardfraud) (MLG-ULB, via Kaggle)
284,807 anonymized European credit card transactions from September 2013, labeled fraudulent or legitimate. Features `V1`–`V28` are PCA-transformed and have no interpretable real-world meaning; `Time` and `Amount` are the only raw features.

## Key Technical Decisions

- **Duplicate rows removed before splitting.** The raw dataset contains 1,081 duplicate rows. Left in place, these can leak into both the train and test sets, artificially inflating evaluation metrics. This was identified, fixed, and verified (zero train/test overlap after the fix).
- **PR-AUC (Average Precision) as the primary metric**, not accuracy. With fraud at ~0.17% of transactions, a model predicting "legitimate" every time would score 99.8% accuracy while catching zero fraud. PR-AUC is far more sensitive to performance on the rare class that actually matters.
- **`scale_pos_weight` tuned, not assumed.** Rather than using the raw negative/positive ratio by default, multiple weight configurations were tested and compared on PR-AUC.
- **SHAP explainability without fabricated meaning.** Since `V1`–`V28` are anonymized PCA components, the dashboard reports feature contributions honestly (e.g. "V14 contributed strongly toward the fraud prediction") rather than inventing real-world interpretations like "unusual location."
- **Threshold analysis, not a default 0.5 cutoff.** Precision/recall/F1 were evaluated across a range of thresholds before choosing a default, and the dashboard exposes this as a live-adjustable slider.

## Model Performance

| Metric | Score |
|---|---|
| PR-AUC (Average Precision) | 0.8187 |
| ROC-AUC | 0.9708 |

**Final model:** XGBoost Classifier — `max_depth=4`, `n_estimators=200`, `learning_rate=0.1`, `subsample=0.8`, `scale_pos_weight` tuned via experimentation (1.0× the negative/positive ratio).

Full experimentation, EDA, threshold analysis, and SHAP breakdown are documented in `notebooks/01_eda_fixed.ipynb`.

## Features

- **Real-time single-transaction prediction** with fraud probability and risk level
- **SHAP explainability** — top contributing features per prediction, visualized in-dashboard
- **Adjustable detection threshold** — live slider recalculates classification without retraining
- **Batch prediction** — upload a CSV of transactions, get fraud predictions for all of them, download results
- **Live transaction monitoring** — running history with search, filtering (by prediction, risk level), and stats
- **Fraud alert banner** for high-confidence fraud detections
- **Health check endpoint** confirming model, scaler, and SHAP explainer are loaded correctly

## Tech Stack

- **Model:** XGBoost, scikit-learn (preprocessing), SHAP (explainability)
- **Backend:** FastAPI, Pydantic, Uvicorn
- **Frontend:** HTML, CSS, vanilla JavaScript, Chart.js
- **Notebook:** Jupyter, pandas, matplotlib, seaborn
- **Deployment:** Replit (Autoscale)

## Project Structure

├── backend/
│ └── main.py # FastAPI application
├── frontend/
│ ├── index.html
│ ├── style.css
│ └── script.js
├── notebooks/
│ ├── 01_eda_fixed.ipynb # EDA, training, evaluation, SHAP
│ └── models/
│ ├── final_model.pkl
│ └── fraud_scaler.pkl
├── data/
│ └── sample_data.csv # Small sample set for the /sample endpoints
├── requirements.txt
└── README.md

## Setup & Run

```bash
# 1. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the API
uvicorn backend.main:app --reload

# 4. Open the dashboard
# http://127.0.0.1:8000/frontend/index.html
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Confirms model, scaler, and SHAP explainer loaded |
| `/predict` | POST | Predicts fraud for a single transaction, returns SHAP explanation |
| `/predict-batch` | POST | Predicts fraud for multiple transactions at once |
| `/sample/legitimate` | GET | Returns a random legitimate transaction (for testing) |
| `/sample/fraud` | GET | Returns a random known fraud transaction (for testing) |
| `/transactions` | GET | Returns processed transaction history |
| `/transactions` | DELETE | Clears transaction history |
| `/stats` | GET | Monitoring statistics (fraud rate, risk breakdown) |

Interactive API docs available at `/docs` once running.

## Known Limitations

This was built as a learning project to demonstrate the end-to-end ML engineering pipeline, and a few simplifications were made deliberately:

- Risk level bands (Low/Medium/High) are fixed and don't shift with the adjustable detection threshold — the threshold controls the Fraud/Legitimate classification, while risk banding is a separate, fixed scale.
- Batch prediction processes transactions sequentially; a single malformed row will fail the whole batch rather than being skipped individually.
- Transaction history is in-memory only (resets on server restart) and includes both live and batch predictions together.

## Acknowledgments

Dataset provided by the Machine Learning Group at Université Libre de Bruxelles (ULB), via Kaggle.
