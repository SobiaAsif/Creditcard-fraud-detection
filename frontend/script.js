// GLOBAL VARIABLES

let riskChartInstance = null;
let allTransactions = [];
let currentTransactionFilter = "All";
let latestBatchResults = [];

// INITIALIZE DASHBOARD ON LOAD

document.addEventListener("DOMContentLoaded", () => {

    // 1. Generate V1 to V28 inputs dynamically

    const featureInputs = document.getElementById("feature-inputs");

    for (let i = 1; i <= 28; i++) {

        const div = document.createElement("div");

        div.innerHTML = `
            <label for="V${i}">V${i}</label>
            <input type="number" id="V${i}" step="any">
        `;

        featureInputs.appendChild(div);
    }

    // 2. Dynamic Threshold Slider Listener

    const thresholdSlider =
        document.getElementById("threshold");

    const thresholdValueLabel =
        document.getElementById("threshold-value");

    thresholdSlider.addEventListener("input", (e) => {

        thresholdValueLabel.innerText =
            `${e.target.value}%`;

    });

    // 3. Initial Dashboard Data Fetches

    checkHealth();
    updateStats();
    fetchTransactions();

});

// API FETCH FUNCTIONS

// HEALTH CHECK

async function checkHealth() {

    try {

        const response = await fetch("/health");

        const data = await response.json();


        document.getElementById("status").innerText =
            `API Status: ${data.status}`;


        document.getElementById("model-status").innerText =
            `Model Loaded: ${
                data.model_loaded
                    ? "Yes 🟢"
                    : "No 🔴"
            }`;


        document.getElementById("scaler-status").innerText =
            `Scaler Loaded: ${
                data.scaler_loaded
                    ? "Yes 🟢"
                    : "No 🔴"
            }`;


        document.getElementById("shap-status").innerText =
            `SHAP Loaded: ${
                data.shap_loaded
                    ? "Yes 🟢"
                    : "No 🔴"
            }`;


    } catch (error) {

        document.getElementById("status").innerText =
            "API Status: Offline 🔴";

        console.error(
            "Health check failed:",
            error
        );

    }

}

// UPDATE DASHBOARD STATISTICS

async function updateStats() {

    try {

        const response = await fetch("/stats");

        if (!response.ok) {
            return;
        }

        const data = await response.json();


        // Text statistics

        document.getElementById("total-transactions").innerText =
            data["Total Transactions"];


        document.getElementById("fraud-transactions").innerText =
            data["Fraud Transactions"];


        document.getElementById("legitimate-transactions").innerText =
            data["Legitimate Transactions"];


        document.getElementById("fraud-rate").innerText =
            data["Fraud Rate"];


        // Risk statistics

        document.getElementById("high-risk").innerText =
            data["High Risk Transactions"];


        document.getElementById("medium-risk").innerText =
            data["Medium Risk Transactions"];


        document.getElementById("low-risk").innerText =
            data["Low Risk Transactions"];


        // Update risk chart

        updateChart(
            data["High Risk Transactions"],
            data["Medium Risk Transactions"],
            data["Low Risk Transactions"]
        );


        // Last updated time

        const now = new Date();

        document.getElementById("last-updated").innerText =
            "Last Updated: " +
            now.toLocaleTimeString();


    } catch (error) {

        console.error(
            "Failed to update stats:",
            error
        );

    }

}

// FETCH TRANSACTIONS

async function fetchTransactions() {

    try {

        const response = await fetch("/transactions");

        if (!response.ok) {
            return;
        }

        const data = await response.json();


        // Store all transactions globally

        allTransactions = data.transactions;


        const tableBody =
            document.getElementById("transaction-table");


        // Clear existing rows

        tableBody.innerHTML = "";


        // No transactions

        if (data.transactions.length === 0) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        No transactions found.
                    </td>
                </tr>
            `;

            updateMonitoringAnalytics();

            return;
        }

// APPLY CURRENT FILTER AND SEARCH

let filteredTransactions =
    allTransactions;


// Apply current filter

if (currentTransactionFilter === "Fraud") {

    filteredTransactions =
        filteredTransactions.filter(
            t => t["Prediction"] === "Fraud"
        );

}

else if (currentTransactionFilter === "Legitimate") {

    filteredTransactions =
        filteredTransactions.filter(
            t => t["Prediction"] === "Legitimate"
        );

}

else if (
    ["High", "Medium", "Low"]
        .includes(currentTransactionFilter)
) {

    filteredTransactions =
        filteredTransactions.filter(
            t =>
                t["Risk Level"] ===
                currentTransactionFilter
        );

}


// Apply transaction ID search

const searchValue = document
    .getElementById("transaction-search")
    .value
    .trim()
    .toLowerCase();


if (searchValue !== "") {

    filteredTransactions =
        filteredTransactions.filter(
            t =>
                t["Transaction ID"] &&
                t["Transaction ID"]
                    .toLowerCase()
                    .includes(searchValue)
        );

}


        // Newest transactions first

        const reversedTransactions =
            [...filteredTransactions].reverse();

// CREATE TRANSACTION ROWS

        reversedTransactions.forEach(t => {

            const row =
                document.createElement("tr");


            // Make entire row clickable

            row.style.cursor = "pointer";


            row.innerHTML = `
                <td>
                    ${
                        t["Transaction ID"]
                            ? t["Transaction ID"].substring(0, 8) + "..."
                            : "N/A"
                    }
                </td>

                <td>
                    ${t["Timestamp"] || "N/A"}
                </td>

                <td>
                    ${t["Fraud Probability"] || "N/A"}
                </td>

                <td>
                    <span class="badge ${
                        t["Risk Level"]
                            ? t["Risk Level"].toLowerCase()
                            : ""
                    }">
                        ${t["Risk Level"] || "N/A"}
                    </span>
                </td>

                <td>
                    <strong>
                        ${t["Prediction"] || "N/A"}
                    </strong>
                </td>
            `;

 // CLICK EVENT

            row.addEventListener("click", () => {

                showTransactionDetails(t);

            });


            tableBody.appendChild(row);

        });


        // Update monitoring analytics

        updateMonitoringAnalytics();


    } catch (error) {

        console.error(
            "Failed to fetch transactions:",
            error
        );

    }

}

// SHOW TRANSACTION DETAILS

function showTransactionDetails(transaction) {

    const detailsContainer =
        document.getElementById("transaction-details");


    // Check if HTML container exists

    if (!detailsContainer) {

        console.error(
            "Transaction details container not found."
        );

        return;
    }

    // BUILD SHAP HTML

    let shapHtml = "";


    if (
        transaction["SHAP Explanation"] &&
        Array.isArray(transaction["SHAP Explanation"]) &&
        transaction["SHAP Explanation"].length > 0
    ) {

        shapHtml = `
            <h4>Top SHAP Factors</h4>

            <table class="shap-table">

                <thead>

                    <tr>
                        <th>Feature</th>
                        <th>SHAP Value</th>
                        <th>Effect on Fraud Risk</th>
                    </tr>

                </thead>

                <tbody>
        `;


        transaction["SHAP Explanation"].forEach(item => {

            const shapValue =
                Number(item["SHAP Value"]);


            shapHtml += `
                <tr>

                    <td>
                        <strong>
                            ${item.Feature}
                        </strong>
                    </td>

                    <td>
                        ${
                            isNaN(shapValue)
                                ? "N/A"
                                : shapValue.toFixed(3)
                        }
                    </td>

                    <td>
                        ${item.Direction || "N/A"}
                    </td>

                </tr>
            `;

        });


        shapHtml += `
                </tbody>

            </table>
        `;

    }

    else {

        shapHtml = `
            <p>
                <strong>SHAP Explanation:</strong>
                No SHAP explanation available.
            </p>
        `;

    }

    // TRANSACTION DETAILS HTML

    const threshold =
        transaction["Threshold"];


    let thresholdText = "N/A";


    if (
        threshold !== undefined &&
        threshold !== null &&
        !isNaN(Number(threshold))
    ) {

        thresholdText =
            `${(Number(threshold) * 100).toFixed(0)}%`;

    }


    detailsContainer.innerHTML = `

        <h3>Transaction Details</h3>


        <p>
            <strong>Transaction ID:</strong>
            ${transaction["Transaction ID"] || "N/A"}
        </p>


        <p>
            <strong>Timestamp:</strong>
            ${transaction["Timestamp"] || "N/A"}
        </p>


        <p>
            <strong>Fraud Probability:</strong>
            ${transaction["Fraud Probability"] || "N/A"}
        </p>


        <p>
            <strong>Risk Level:</strong>
            ${transaction["Risk Level"] || "N/A"}
        </p>


        <p>
            <strong>Prediction:</strong>
            ${transaction["Prediction"] || "N/A"}
        </p>


        <p>
            <strong>Detection Threshold:</strong>
            ${thresholdText}
        </p>


        ${shapHtml}

    `;


    // Show details section

    detailsContainer.style.display =
        "block";


    // Scroll to details

    detailsContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

}

// MONITORING ANALYTICS

function updateMonitoringAnalytics() {

    const total =
        allTransactions.length;

    // NO TRANSACTIONS

    if (total === 0) {

        document.getElementById(
            "fraud-detection-rate"
        ).innerText = "0 / 0";


        document.getElementById(
            "high-risk-rate"
        ).innerText = "0%";


        document.getElementById(
            "average-fraud-probability"
        ).innerText = "0%";


        document.getElementById(
            "latest-activity"
        ).innerText = "--";


        return;
    }

    // COUNT FRAUD

    const fraudCount =
        allTransactions.filter(
            t => t["Prediction"] === "Fraud"
        ).length;

    // COUNT HIGH RISK

    const highRiskCount =
        allTransactions.filter(
            t => t["Risk Level"] === "High"
        ).length;

    // AVERAGE FRAUD PROBABILITY

    const probabilities =
        allTransactions
            .map(t => {

                const value =
                    parseFloat(
                        String(
                            t["Fraud Probability"] || "0"
                        ).replace("%", "")
                    );

                return isNaN(value) ? 0 : value;

            });


    const averageProbability =
        probabilities.reduce(
            (sum, value) => sum + value,
            0
        ) / total;

    // LATEST TRANSACTION

    const latestTransaction =
        allTransactions[
            allTransactions.length - 1
        ];

    // UPDATE ANALYTICS CARDS

    document.getElementById(
        "fraud-detection-rate"
    ).innerText =
        `${fraudCount} / ${total}`;


    document.getElementById(
        "high-risk-rate"
    ).innerText =
        `${((highRiskCount / total) * 100).toFixed(2)}%`;


    document.getElementById(
        "average-fraud-probability"
    ).innerText =
        `${averageProbability.toFixed(2)}%`;


    document.getElementById(
        "latest-activity"
    ).innerText =
        latestTransaction["Timestamp"] || "--";

}

// SAMPLE DATA LOADERS

async function loadSampleData(type) {

    try {

        const response =
            await fetch(`/sample/${type}`);


        if (!response.ok) {

            throw new Error(
                `Failed to fetch ${type} sample`
            );

        }


        const data =
            await response.json();


        // Time

        document.getElementById("Time").value =
            data.Time;


        // Amount

        document.getElementById("Amount").value =
            data.Amount;


        // V1 - V28

        for (let i = 1; i <= 28; i++) {

            document.getElementById(
                `V${i}`
            ).value =
                data[`V${i}`];

        }


    } catch (error) {

        alert(error.message);

    }

}


function loadLegitimateSample() {

    loadSampleData("legitimate");

}


function loadFraudSample() {

    loadSampleData("fraud");

}

// SINGLE TRANSACTION PREDICTION

async function predictTransaction() {

    const payload = {};

    // TIME AND AMOUNT

    const timeVal =
        document.getElementById("Time").value;


    const amountVal =
        document.getElementById("Amount").value;


    if (
        timeVal === "" ||
        amountVal === ""
    ) {

        alert(
            "Please fill in Time and Amount."
        );

        return;
    }


    payload.Time =
        parseFloat(timeVal);


    payload.Amount =
        parseFloat(amountVal);

    // V1 TO V28

    for (let i = 1; i <= 28; i++) {

        const val =
            document.getElementById(
                `V${i}`
            ).value;


        if (val === "") {

            alert(
                `Please fill in feature V${i}.`
            );

            return;
        }


        payload[`V${i}`] =
            parseFloat(val);

    }

    // THRESHOLD

    const thresholdPercentage =
        document.getElementById(
            "threshold"
        ).value;


    const thresholdFloat =
        (
            parseFloat(thresholdPercentage) / 100
        ).toFixed(2);

    // SEND REQUEST TO API

    try {

        const response =
            await fetch(
                `/predict?threshold=${thresholdFloat}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(payload)
                }
            );


        if (!response.ok) {

            const errData =
                await response.json();


            throw new Error(
                errData.detail ||
                "Prediction failed"
            );

        }


        const result =
            await response.json();


        // Display result

        displayPredictionResult(result);


        // Refresh dashboard

        updateStats();

        fetchTransactions();


    } catch (error) {

        alert(
            `Error: ${error.message}`
        );

    }

}

// DISPLAY PREDICTION RESULT

function displayPredictionResult(result) {

    const resultContainer =
        document.getElementById(
            "prediction-result"
        );


    const resultMessage =
        document.getElementById(
            "result-message"
        );


    const fraudAlert =
        document.getElementById(
            "fraud-alert"
        );


    const fraudAlertMessage =
        document.getElementById(
            "fraud-alert-message"
        );

// FRAUD PROBABILITY VISUALIZATION

const probabilityValue =
    document.getElementById("fraud-probability-value");

const probabilityBar =
    document.getElementById("fraud-probability-bar");

const probabilityText =
    result["Fraud Probability"];

const probability =
    parseFloat(
        probabilityText.replace("%", "")
    );

probabilityValue.innerText =
    `${probability.toFixed(2)}%`;

probabilityBar.style.width =
    `${Math.max(0, Math.min(probability, 100))}%`;

// FRAUD / LEGITIMATE ALERT

if (result.Prediction === "Fraud") {

    fraudAlertMessage.innerText =
        `Fraud detected! Fraud probability is ${result["Fraud Probability"]}.`;

}
else {

    fraudAlertMessage.innerText =
        `No fraud detected. Fraud probability is ${result["Fraud Probability"]}.`;

}

    // SHAP EXPLANATION

    let shapHtml = `
        <br>

        <strong>
            Top SHAP Factors:
        </strong>

        <table class="shap-table">

            <thead>

                <tr>
                    <th>Feature</th>
                    <th>SHAP Value</th>
                    <th>Effect on Fraud Risk</th>
                </tr>

            </thead>

            <tbody>
    `;


    if (
        result["SHAP Explanation"] &&
        Array.isArray(
            result["SHAP Explanation"]
        )
    ) {

        result["SHAP Explanation"].forEach(item => {

            const shapValue =
                Number(item["SHAP Value"]);


            shapHtml += `
                <tr>

                    <td>
                        <strong>
                            ${item.Feature}
                        </strong>
                    </td>

                    <td>
                        ${
                            isNaN(shapValue)
                                ? "N/A"
                                : shapValue.toFixed(3)
                        }
                    </td>

                    <td>
                        ${item.Direction || "N/A"}
                    </td>

                </tr>
            `;

        });

    }


    shapHtml += `
            </tbody>

        </table>
    `;

    // RESULT MESSAGE

    const threshold =
        result["Threshold"];


    const thresholdText =
        threshold !== undefined &&
        threshold !== null &&
        !isNaN(Number(threshold))
            ? `${(
                Number(threshold) * 100
              ).toFixed(0)}%`
            : "N/A";


    resultMessage.innerHTML = `

        <strong>Prediction:</strong>
        ${result.Prediction}

        <br>

        <strong>Probability:</strong>
        ${result["Fraud Probability"]}

        <br>

        <strong>Risk Level:</strong>
        ${result["Risk Level"]}

        <br>

        <strong>Detection Threshold:</strong>
        ${thresholdText}

        <br>

        <strong>Message:</strong>
        ${result["Risk Message"]}

        ${shapHtml}

    `;

    // VISUAL INDICATORS

    if (
        result.Prediction === "Fraud"
    ) {

        resultContainer.style.backgroundColor =
            "#ffcccc";


        resultContainer.style.border =
            "1px solid red";


        // Show urgent alert

        fraudAlert.classList.remove(
            "hidden"
        );


        fraudAlertMessage.innerText =
            `Transaction ID ${
                result["Transaction ID"]
                    ? result["Transaction ID"]
                        .substring(0, 8)
                    : "N/A"
            } flagged as fraud with ${
                result["Fraud Probability"]
            } probability.`;


        fraudAlert.style.display =
            "block";

    }

    else {

        resultContainer.style.backgroundColor =
            "#ccffcc";


        resultContainer.style.border =
            "1px solid green";


        // Hide alert

        fraudAlert.classList.add(
            "hidden"
        );


        fraudAlert.style.display =
            "none";

    }

}

// CHART.JS INTEGRATION

function updateChart(
    high,
    medium,
    low
) {

    // Check Chart.js

    if (
        typeof Chart === "undefined"
    ) {

        return;
    }


    const ctx =
        document.getElementById(
            "risk-chart"
        );


    if (!ctx) {

        return;
    }


    // Update existing chart

    if (riskChartInstance) {

        riskChartInstance
            .data
            .datasets[0]
            .data =
            [
                high,
                medium,
                low
            ];


        riskChartInstance.update();

    }


    // Create chart

    else {

        riskChartInstance =
            new Chart(
                ctx,
                {
                    type: "doughnut",

                    data: {

                        labels: [
                            "High Risk",
                            "Medium Risk",
                            "Low Risk"
                        ],

                        datasets: [

                            {

                                data: [
                                    high,
                                    medium,
                                    low
                                ],

                                backgroundColor: [
                                    "#ff4d4d",
                                    "#ffc107",
                                    "#28a745"
                                ],

                                borderWidth: 1

                            }

                        ]

                    },

                    options: {

                        responsive: true,

                        maintainAspectRatio:
                            false

                    }

                }
            );

    }

}

// CLEAR TRANSACTION HISTORY

async function clearTransactionHistory() {

    const confirmed =
        confirm(
            "Are you sure you want to clear all transaction history?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                "/transactions",
                {
                    method: "DELETE"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Failed to clear transaction history."
            );

        }


        const data =
            await response.json();


        alert(data.message);


        // Refresh dashboard

        updateStats();

        fetchTransactions();


    } catch (error) {

        alert(
            `Error: ${error.message}`
        );

    }

}

// FILTER TRANSACTIONS

function filterTransactions(filter) {

    currentTransactionFilter =
        filter;


    const tableBody =
        document.getElementById(
            "transaction-table"
        );


    tableBody.innerHTML = "";

    // FILTER DATA

    let filteredTransactions =
        allTransactions;


    if (
        filter === "Fraud"
    ) {

        filteredTransactions =
            allTransactions.filter(
                t =>
                    t["Prediction"] ===
                    "Fraud"
            );

    }


    else if (
        filter === "Legitimate"
    ) {

        filteredTransactions =
            allTransactions.filter(
                t =>
                    t["Prediction"] ===
                    "Legitimate"
            );

    }


    else if (
        ["High", "Medium", "Low"]
            .includes(filter)
    ) {

        filteredTransactions =
            allTransactions.filter(
                t =>
                    t["Risk Level"] ===
                    filter
            );

    }

    // NO RESULTS

    if (
        filteredTransactions.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No transactions found.
                </td>
            </tr>
        `;

        return;

    }

    // DISPLAY FILTERED TRANSACTIONS

    [
        ...filteredTransactions
    ]
        .reverse()
        .forEach(t => {

            const row =
                document.createElement("tr");


            // Make row clickable

            row.style.cursor =
                "pointer";


            row.innerHTML = `

                <td>
                    ${
                        t["Transaction ID"]
                            ? t["Transaction ID"]
                                .substring(0, 8)
                                + "..."
                            : "N/A"
                    }
                </td>

                <td>
                    ${t["Timestamp"] || "N/A"}
                </td>

                <td>
                    ${t["Fraud Probability"] || "N/A"}
                </td>

                <td>

                    <span class="badge ${
                        t["Risk Level"]
                            ? t["Risk Level"]
                                .toLowerCase()
                            : ""
                    }">

                        ${
                            t["Risk Level"] ||
                            "N/A"
                        }

                    </span>

                </td>

                <td>

                    <strong>
                        ${
                            t["Prediction"] ||
                            "N/A"
                        }
                    </strong>

                </td>

            `;


            // Click transaction

            row.addEventListener(
                "click",
                () => {

                    showTransactionDetails(t);

                }
            );


            tableBody.appendChild(row);

        });

}

function searchTransaction() {
    fetchTransactions();
}


function clearTransactionSearch() {

    document.getElementById("transaction-search").value = "";

    fetchTransactions();
}

// BATCH PREDICTION

async function predictBatch() {

    const fileInput =
        document.getElementById(
            "csv-file"
        );


    const resultContainer =
        document.getElementById(
            "batch-result"
        );


    const tableContainer =
        document.getElementById(
            "batch-results-table"
        );


    if (
        !fileInput ||
        !resultContainer ||
        !tableContainer
    ) {

        console.error(
            "Batch prediction HTML elements are missing."
        );

        return;

    }

    // CHECK FILE

    if (
        fileInput.files.length === 0
    ) {

        alert(
            "Please select a CSV file."
        );

        return;

    }


    const file =
        fileInput.files[0];


    try {

        // Read CSV

        const text =
            await file.text();


        const rows =
            text.trim().split("\n");


        if (
            rows.length < 2
        ) {

            throw new Error(
                "CSV file does not contain transaction data."
            );

        }

        // HEADERS

        const headers =
            rows[0]
                .split(",")
                .map(
                    header =>
                        header.trim()
                );


        // Required headers

        const requiredHeaders = [
            "Time",
            "Amount"
        ];


        for (
            let i = 1;
            i <= 28;
            i++
        ) {

            requiredHeaders.push(
                `V${i}`
            );

        }


        // Check missing headers

        const missingHeaders =
            requiredHeaders.filter(
                header =>
                    !headers.includes(
                        header
                    )
            );


        if (
            missingHeaders.length > 0
        ) {

            throw new Error(
                `Missing required columns: ${
                    missingHeaders.join(", ")
                }`
            );

        }

        // PARSE TRANSACTIONS

        const transactions = [];


        for (
            let i = 1;
            i < rows.length;
            i++
        ) {

            const values =
                rows[i].split(",");


            if (
                values.length !==
                headers.length
            ) {

                continue;

            }


            const transaction = {};


            headers.forEach(
                (header, index) => {

                    const value =
                        values[index].trim();


                    if (
                        value === ""
                    ) {

                        throw new Error(
                            `Empty value found in row ${
                                i + 1
                            }, column ${header}.`
                        );

                    }


                    const numberValue =
                        parseFloat(value);


                    if (
                        isNaN(numberValue)
                    ) {

                        throw new Error(
                            `Invalid number found in row ${
                                i + 1
                            }, column ${header}.`
                        );

                    }


                    transaction[header] =
                        numberValue;

                }
            );


            transactions.push(
                transaction
            );

        }


        if (
            transactions.length === 0
        ) {

            throw new Error(
                "No valid transactions found in CSV."
            );

        }

        // THRESHOLD

        const thresholdPercentage =
            document.getElementById(
                "threshold"
            ).value;


        const thresholdFloat =
            (
                parseFloat(
                    thresholdPercentage
                ) / 100
            ).toFixed(2);

        // SEND BATCH REQUEST

        const response =
            await fetch(
                `/predict-batch?threshold=${thresholdFloat}`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            transactions:
                                transactions
                        })

                }
            );


        if (!response.ok) {

            const errorData =
                await response.json();


            throw new Error(
                errorData.detail ||
                "Batch prediction failed."
            );

        }


        const data =
            await response.json();

        latestBatchResults = data.transactions;

        document.getElementById("download-batch-btn").style.display = "inline-block";    

        // COUNT RESULTS

        const fraudCount =
            data.transactions.filter(
                t =>
                    t.Prediction ===
                    "Fraud"
            ).length;


        const legitimateCount =
            data.transactions.filter(
                t =>
                    t.Prediction ===
                    "Legitimate"
            ).length;


        const highRiskCount =
            data.transactions.filter(
                t =>
                    t["Risk Level"] ===
                    "High"
            ).length;


        const mediumRiskCount =
            data.transactions.filter(
                t =>
                    t["Risk Level"] ===
                    "Medium"
            ).length;


        const lowRiskCount =
            data.transactions.filter(
                t =>
                    t["Risk Level"] ===
                    "Low"
            ).length;

        // BATCH SUMMARY

        resultContainer.innerHTML = `

            <h3>
                Batch Prediction Complete
            </h3>

            <p>
                Detection Threshold:
                <strong>
                    ${thresholdPercentage}%
                </strong>
            </p>

            <p>
                Total Transactions:
                <strong>
                    ${data.total_transactions}
                </strong>
            </p>

            <p>
                Fraud Transactions:
                <strong>
                    ${fraudCount}
                </strong>
            </p>

            <p>
                Legitimate Transactions:
                <strong>
                    ${legitimateCount}
                </strong>
            </p>

            <p>
                High Risk:
                <strong>
                    ${highRiskCount}
                </strong>
            </p>

            <p>
                Medium Risk:
                <strong>
                    ${mediumRiskCount}
                </strong>
            </p>

            <p>
                Low Risk:
                <strong>
                    ${lowRiskCount}
                </strong>
            </p>

        `;

        // BATCH RESULTS TABLE

        let tableHtml = `

            <h3>
                Batch Results
            </h3>

            <table>

                <thead>

                    <tr>

                        <th>#</th>

                        <th>
                            Transaction ID
                        </th>

                        <th>
                            Fraud Probability
                        </th>

                        <th>
                            Risk Level
                        </th>

                        <th>
                            Prediction
                        </th>

                    </tr>

                </thead>

                <tbody>

        `;


        data.transactions.forEach(
            (transaction, index) => {

                tableHtml += `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>


                        <td>
                            ${
                                transaction[
                                    "Transaction ID"
                                ]
                                    ? transaction[
                                        "Transaction ID"
                                      ].substring(
                                        0,
                                        8
                                      ) + "..."
                                    : "N/A"
                            }
                        </td>


                        <td>
                            ${
                                transaction[
                                    "Fraud Probability"
                                ] || "N/A"
                            }
                        </td>


                        <td>

                            <span class="badge ${
                                transaction[
                                    "Risk Level"
                                ]
                                    ? transaction[
                                        "Risk Level"
                                      ].toLowerCase()
                                    : ""
                            }">

                                ${
                                    transaction[
                                        "Risk Level"
                                    ] || "N/A"
                                }

                            </span>

                        </td>


                        <td>

                            <strong>
                                ${
                                    transaction[
                                        "Prediction"
                                    ] || "N/A"
                                }
                            </strong>

                        </td>

                    </tr>

                `;

            }
        );


        tableHtml += `

                </tbody>

            </table>

        `;


        tableContainer.innerHTML =
            tableHtml;

        // REFRESH DASHBOARD

        updateStats();

        fetchTransactions();


    } catch (error) {

        resultContainer.innerHTML = `

            <p>

                <strong>
                    Error:
                </strong>

                ${error.message}

            </p>

        `;


        tableContainer.innerHTML = "";

    }

}

// AUTO REFRESH

setInterval(
    () => {

        updateStats();

        fetchTransactions();

        updateMonitoringAnalytics();

    },
    5000
);

function downloadBatchResults() {

    if (latestBatchResults.length === 0) {
        alert("No batch results available to download.");
        return;
    }

    const headers = [
        "Transaction ID",
        "Fraud Probability",
        "Risk Level",
        "Prediction"
    ];

    const rows = latestBatchResults.map(transaction => [
        transaction["Transaction ID"],
        transaction["Fraud Probability"],
        transaction["Risk Level"],
        transaction["Prediction"]
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row =>
            row.map(value =>
                `"${String(value).replace(/"/g, '""')}"`
            ).join(",")
        )
    ].join("\n");

    const blob = new Blob(
        [csvContent],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "fraud_detection_results.csv";

    link.click();

    URL.revokeObjectURL(url);
}