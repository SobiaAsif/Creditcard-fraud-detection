
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
