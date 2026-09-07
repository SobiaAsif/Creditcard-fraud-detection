import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import joblib
import pandas as pd
import shap
from datetime import datetime

# 1. Path Resolutions
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

MODEL_PATH = PROJECT_ROOT / "notebooks" / "models" / "final_model.pkl"
SCALER_PATH = PROJECT_ROOT / "notebooks" / "models" / "fraud_scaler.pkl"
DATASET_PATH = PROJECT_ROOT / "data" / "sample_data.csv"

model = None
scaler = None
explainer = None  

# In-memory "database" to store transaction history
transactions = []

# 2. Lifecycle manager to load artifacts on startup
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Loads the model, scaler, and SHAP explainer dynamically on server startup."""
    global model, scaler, explainer

    if not MODEL_PATH.exists() or not SCALER_PATH.exists():
        raise RuntimeError(
            f"Required ML artifacts are missing!\n"
            f"Expected Model at: {MODEL_PATH}\n"
            f"Expected Scaler at: {SCALER_PATH}"
        )

    # Load model and scaler
    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    
    # Initialize the SHAP explainer using the loaded model
    explainer = shap.TreeExplainer(model)
    
    print("🚀 final_model.pkl, fraud_scaler.pkl, and SHAP explainer loaded successfully!")
    yield

# 3. Create FastAPI app
app = FastAPI(
    title="Credit Card Fraud Detection API",
    version="1.0.0",
    lifespan=lifespan,
)

FRONTEND_PATH = PROJECT_ROOT / "frontend"

app.mount(
    "/frontend",
    StaticFiles(directory=FRONTEND_PATH, html=True),
    name="frontend"
)

# 4. Input Data Schemas
class TransactionInput(BaseModel):
    Time: float = Field(..., description="Seconds elapsed since the first transaction.")
    V1: float; V2: float; V3: float; V4: float; V5: float
    V6: float; V7: float; V8: float; V9: float; V10: float
    V11: float; V12: float; V13: float; V14: float; V15: float
    V16: float; V17: float; V18: float; V19: float; V20: float
    V21: float; V22: float; V23: float; V24: float; V25: float
    V26: float; V27: float; V28: float
    Amount: float = Field(..., description="Transaction amount.")

class BatchTransactionInput(BaseModel):
    transactions: list[TransactionInput]


# 5. Output Data Schemas
class SHAPExplanation(BaseModel):
    feature: str = Field(..., alias="Feature")
    shap_value: float = Field(..., alias="SHAP Value")
    direction: str = Field(..., alias="Direction")

class PredictionResponse(BaseModel):
    transaction_id: str = Field(..., alias="Transaction ID")
    fraud_probability: str = Field(..., alias="Fraud Probability")
    risk_level: str = Field(..., alias="Risk Level")
    risk_message: str = Field(..., alias="Risk Message")
    fraud_probability_score: float = Field(..., alias="Fraud Probability Score")
    legitimate_probability_score: float = Field(..., alias="Legitimate Probability Score")
    prediction: str = Field(..., alias="Prediction")
    threshold: float = Field(..., alias="Threshold")
    shap_explanation: list[SHAPExplanation] = Field(..., alias="SHAP Explanation")


# 6. Base Status Endpoint
@app.get("/")
def read_root():
    """Confirms the API status."""
    return {"message": "Credit Card Fraud Detection API is running"}


# 7. Sample Endpoints
@app.get("/sample/legitimate")
def get_legitimate_sample():
    """Fetches a random legitimate transaction from the dataset."""
    try:
        df = pd.read_csv(DATASET_PATH)
        sample = df[df["Class"] == 0].sample(1).iloc[0]
        transaction = sample.drop("Class").to_dict()
        return transaction
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load legitimate sample: {str(e)}"
        )

@app.get("/sample/fraud")
def get_fraud_sample():
    """Fetches a random fraudulent transaction from the dataset."""
    try:
        df = pd.read_csv(DATASET_PATH)
        sample = df[df["Class"] == 1].sample(1).iloc[0]
        transaction = sample.drop("Class").to_dict()
        return transaction
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load fraud sample: {str(e)}"
        )


# 8. Fraud Prediction Endpoint
@app.post("/predict", response_model=PredictionResponse)
def predict_fraud(
    data: TransactionInput,
    threshold: float = Query(0.50, ge=0.01, le=0.99)
):
    """
    Receives 30 features, scales Time and Amount,
    extracts top 5 SHAP values, and returns probability.
    """
    try:
        input_dict = data.model_dump() 
        df = pd.DataFrame([input_dict])
        
        unscaled_features = df[['Time', 'Amount']]
        scaled_features = scaler.transform(unscaled_features)
        
        df[['Time', 'Amount']] = scaled_features
        
        feature_columns = ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"]
        df = df[feature_columns]
        
        fraud_prob = float(model.predict_proba(df)[0, 1])
        legitimate_prob = 1 - fraud_prob
        prediction_label = "Fraud" if fraud_prob >= threshold else "Legitimate"
        
        if fraud_prob < 0.20:
            risk_level = "Low"
        elif fraud_prob < 0.50:
            risk_level = "Medium"
        else:
            risk_level = "High"
            
        if risk_level == "High":
            risk_message = "Transaction requires immediate review."
        elif risk_level == "Medium":
            risk_message = "Transaction should be reviewed."
        else:
            risk_message = "Transaction appears to be legitimate."
        
        shap_values = explainer.shap_values(df)
        shap_row = shap_values[0]
        
        shap_table = pd.DataFrame({
            "Feature": df.columns,
            "SHAP Value": shap_row
        })

        shap_table["Direction"] = shap_table["SHAP Value"].apply(
            lambda value: "Increases Fraud Risk" if value > 0 else "Decreases Fraud Risk"
        )

        shap_table["Importance"] = shap_table["SHAP Value"].abs()
        shap_table = shap_table.sort_values("Importance", ascending=False)
        
        top_shap = shap_table.head(5)
        shap_explanation = top_shap[["Feature", "SHAP Value", "Direction"]].to_dict(orient="records")
        
        transaction_id = str(uuid.uuid4())

        transaction_record = {
            "Transaction ID": transaction_id,
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Fraud Probability": f"{fraud_prob * 100:.2f}%",
            "Risk Level": risk_level,
            "Prediction": prediction_label,
            "Threshold": threshold,
            "SHAP Explanation": shap_explanation
        }
        transactions.append(transaction_record)
        
        return {
            "Transaction ID": transaction_id,
            "Fraud Probability": f"{fraud_prob * 100:.2f}%",
            "Risk Level": risk_level,
            "Risk Message": risk_message,
            "Fraud Probability Score": fraud_prob,
            "Legitimate Probability Score": legitimate_prob,
            "Prediction": prediction_label,
            "Threshold": threshold,
            "SHAP Explanation": shap_explanation
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference Pipeline Error: {str(e)}")


# 9. Batch Prediction Endpoint
@app.post("/predict-batch")
def predict_batch(
    data: BatchTransactionInput,
    threshold: float = Query(0.50, ge=0.01, le=0.99)
):
    """Processes multiple transactions using the prediction pipeline."""
    results = []

    for transaction in data.transactions:
        result = predict_fraud(transaction, threshold=threshold)
        results.append(result)

    return {
        "total_transactions": len(results),
        "transactions": results
    }


# 10. Transactions Endpoint
@app.get("/transactions")
def get_transactions():
    """Returns all processed transactions for monitoring."""
    return {
        "total_transactions": len(transactions),
        "transactions": transactions
    }

@app.delete("/transactions")
def clear_transactions():
    """Clears all stored transaction history."""
    transactions.clear()

    return {
        "message": "Transaction history cleared successfully.",
        "total_transactions": 0
    }


# 11. Stats Endpoint
@app.get("/stats")
def get_stats():
    """Returns monitoring statistics for processed transactions."""
    total = len(transactions)
    
    fraud_count = sum(1 for t in transactions if t["Prediction"] == "Fraud")
    legitimate_count = total - fraud_count
    high_risk_count = sum(1 for t in transactions if t["Risk Level"] == "High")
    medium_risk_count = sum(1 for t in transactions if t["Risk Level"] == "Medium")
    low_risk_count = sum(1 for t in transactions if t["Risk Level"] == "Low")
    
    fraud_rate = (fraud_count / total * 100) if total > 0 else 0

    return {
        "Total Transactions": total,
        "Fraud Transactions": fraud_count,
        "Legitimate Transactions": legitimate_count,
        "Fraud Rate": f"{fraud_rate:.2f}%",
        "High Risk Transactions": high_risk_count,
        "Medium Risk Transactions": medium_risk_count,
        "Low Risk Transactions": low_risk_count
    }


# 12. Health Check Endpoint
@app.get("/health")
def health_check():
    """Checks whether the API and ML model are ready."""
    return {
       "status": "healthy",
       "model_loaded": model is not None,
       "scaler_loaded": scaler is not None,
       "shap_loaded": explainer is not None
    }