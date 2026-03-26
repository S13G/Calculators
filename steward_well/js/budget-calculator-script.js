// Register Chart.js datalabels plugin
Chart.register(ChartDataLabels);

// A central object to hold the results of calculations to be used across different functions.
const calculatorState = {
  annualIncome: 0,
  province: "",
  ageGroup: "", // Added age group tracking
  retirementPercentage: 0,
  monthlyDisposableIncome: 0,
  livingExpenses: {},
  totalMonthlyExpensesEntered: 0,
  annualDisposable: 0,
  // Track if user has entered custom savings/investment values
  hasCustomSavings: false,
  hasCustomInvestments: false,
  // Track if any expense field has been touched
  hasEnteredExpenses: false,
  // Track if custom savings/investments toggle is on
  customSavingsToggleEnabled: false,
  // Default values for compound interest calculation
  compoundInterest: {
    years: 5, // Default number of years
    returnRate: 6, // Default annual return rate (6%)
    compoundFrequency: 12, // Monthly compounding
    currentChartType: "savings", // Default chart type (savings, investments, or both)
  },
  customCompoundInterest: {
    years: 5,
    returnRate: 6, // percentage
    compoundFrequency: 12, // monthly
    currentChartType: "savings", // 'savings', 'investments', 'both'
  },
  // Store the current budget calculation results
  currentBudget: null,
  deductionsExpanded: false,
};

// Core tax and deduction calculation functions.

// Helper to target all elements with a specific ID (handling duplicate IDs)
function getAllElements(id) {
  return document.querySelectorAll(`[id="${id}"]`);
}

function isPrintDownloadReady() {
  return (
    calculatorState.annualIncome > 0 && !!calculatorState.hasEnteredExpenses
  );
}

function updatePrintDownloadButtonState() {
  const btns = getAllElements("print-download-btn").length
    ? getAllElements("print-download-btn")
    : document.querySelectorAll(
        "#print-download-btn, #print-download-btn-mobile",
      );

  if (!btns.length) return;
  const ready = isPrintDownloadReady();

  btns.forEach((btn) => {
    btn.classList.toggle("opacity-50", !ready);
    btn.classList.toggle("cursor-not-allowed", !ready);
    btn.setAttribute("aria-disabled", ready ? "false" : "true");
    btn.style.opacity = ready ? "" : "0.5";
    btn.style.cursor = ready ? "" : "not-allowed";
  });
}

function showToast(message) {
  const existing = document.getElementById("sw-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "sw-toast";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.left = "50%";
  toast.style.bottom = "24px";
  toast.style.transform = "translateX(-50%)";
  toast.style.backgroundColor = "#0f172a";
  toast.style.backgroundImage = "linear-gradient(to right, #177F5B, #154D80)";
  toast.style.color = "#ffffff";
  toast.style.padding = "12px 18px";
  toast.style.borderRadius = "16px";
  toast.style.border = "1px solid rgba(255, 255, 255, 0.22)";
  toast.style.boxShadow = "0 14px 38px rgba(2, 6, 23, 0.28)";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "14px";
  toast.style.lineHeight = "1.3";
  toast.style.maxWidth = "90vw";
  toast.style.opacity = "0";
  toast.style.transition = "opacity 180ms ease";
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
  });

  const hide = () => {
    toast.style.opacity = "0";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 220);
  };

  setTimeout(hide, 3200);
}

/**
 * Calculates tax based on progressive (marginal) tax brackets.
 */

function calculateProgressiveTax(income, brackets) {
  let totalTax = 0;
  for (const bracket of brackets) {
    if (income > bracket.min) {
      const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
      totalTax += taxableInBracket * bracket.rate;
    }
  }
  return totalTax;
}

/**
 * Calculates Canada Pension Plan (CPP) contribution.
 */
function calculateCPP(income, cppConfig) {
  if (income <= cppConfig.basicExemption) {
    return 0;
  }
  const contributoryEarnings =
    Math.min(income, cppConfig.maxEarnings) - cppConfig.basicExemption;
  const contribution = contributoryEarnings * cppConfig.rate;
  return Math.min(contribution, cppConfig.maxContribution);
}

/**
 * Calculates Employment Insurance (EI) contribution.
 */
function calculateEI(income, eiConfig) {
  const contribution = Math.min(income, eiConfig.maxEarnings) * eiConfig.rate;
  return Math.min(contribution, eiConfig.maxContribution);
}

/**
 * Calculates all federal and provincial taxes, CPP, and EI deductions.
 */
function calculateTaxes(grossIncome, province, retirementPercentage = 0) {
  const config = TAX_CONFIG.canada;
  const retirementContribution = grossIncome * (retirementPercentage / 100);
  const taxableIncome = grossIncome - retirementContribution;
  const deductions = {};

  // Federal Tax
  const federalTax = calculateProgressiveTax(
    taxableIncome,
    config.federal.brackets,
  );
  deductions.federal_tax = {
    amount: federalTax,
    percentage: (federalTax / grossIncome) * 100,
    name: "Federal Tax",
  };

  // Define custom color schemes for custom charts
  const customColorSchemes = {
    savings: {
      backgroundColor: [
        "rgba(233, 30, 99, 0.8)", // Pink for contributions
        "rgba(0, 188, 212, 0.8)", // Cyan for interest
        "rgba(63, 81, 181, 0.8)", // Indigo for ending balance
      ],
      borderColor: [
        "rgba(233, 30, 99, 1)",
        "rgba(0, 188, 212, 1)",
        "rgba(63, 81, 181, 1)",
      ],
      borderWidth: 2,
    },
    investments: {
      backgroundColor: [
        "rgba(255, 87, 34, 0.8)", // Deep orange for contributions
        "rgba(139, 195, 74, 0.8)", // Light green for interest
        "rgba(156, 39, 176, 0.8)", // Purple for ending balance
      ],
      borderColor: [
        "rgba(255, 87, 34, 1)",
        "rgba(139, 195, 74, 1)",
        "rgba(156, 39, 176, 1)",
      ],
      borderWidth: 3,
    },
    both: {
      backgroundColor: [
        "rgba(121, 85, 72, 0.8)", // Brown for contributions
        "rgba(96, 125, 139, 0.8)", // Blue grey for interest
        "rgba(255, 152, 0, 0.8)", // Orange for ending balance
      ],
      borderColor: [
        "rgba(121, 85, 72, 1)",
        "rgba(96, 125, 139, 1)",
        "rgba(255, 152, 0, 1)",
      ],
      borderWidth: 1,
    },
  };

  // Provincial Tax
  if (province && config.provinces[province]) {
    const provincialTax = calculateProgressiveTax(
      taxableIncome,
      config.provinces[province].brackets,
    );
    deductions.provincial_tax = {
      amount: provincialTax,
      percentage: (provincialTax / grossIncome) * 100,
      name: `${config.provinces[province].name} Tax`,
    };
  }

  // CPP (on gross income)
  const cppContribution = calculateCPP(grossIncome, config.cpp);
  deductions.cpp = {
    amount: cppContribution,
    percentage: (cppContribution / grossIncome) * 100,
    name: "CPP",
  };

  // EI (on gross income)
  const eiContribution = calculateEI(grossIncome, config.ei);
  deductions.ei = {
    amount: eiContribution,
    percentage: (eiContribution / grossIncome) * 100,
    name: "EI",
  };

  // Retirement Contribution
  if (retirementPercentage > 0) {
    deductions.retirement = {
      amount: retirementContribution,
      percentage: retirementPercentage,
      name: "Retirement Contribution",
    };
  }

  const totalDeductions = Object.values(deductions).reduce(
    (sum, deduction) => sum + deduction.amount,
    0,
  );

  return { deductions, totalDeductions };
}

/**
 * Calculates all budget allocations (taxes, expenses, savings, investments, cashflow).
 */
function calculateBudget(
  annualIncome,
  province,
  livingExpenses,
  retirementPercentage,
  userSavingsPct = 0,
  userInvestmentsPct = 0,
) {
  // Calculate taxes and deductions
  const { deductions, totalDeductions } = calculateTaxes(
    annualIncome,
    province,
    retirementPercentage,
  );

  // Calculate disposable income
  const annualDisposableIncome = annualIncome - totalDeductions;
  const monthlyDisposableIncome = annualDisposableIncome / 12;

  // Calculate total monthly expenses
  const totalMonthlyExpenses = Object.values(livingExpenses).reduce(
    (sum, expense) => sum + (parseFloat(expense) || 0),
    0,
  );

  // Calculate expenses as a percentage of disposable income
  const expensesPercentage =
    monthlyDisposableIncome > 0
      ? (totalMonthlyExpenses / monthlyDisposableIncome) * 100
      : 0;

  const monthlyTakeHomePay = monthlyDisposableIncome;
  // Calculate 10% base cashflow (reserved first)
  const baseCashflowAmt = monthlyTakeHomePay > 0 ? 0.1 * monthlyTakeHomePay : 0;
  // Allocatable remainder is TakeHome - Expenses
  // This pool is used for savings and investment percentages
  const remainder = Math.max(0, monthlyTakeHomePay - totalMonthlyExpenses);

  // === RECOMMENDED ALLOCATIONS ===
  const recommendedSavingsPct = remainder > 0 ? 15 : 0;
  const recommendedInvestmentsPct = remainder > 0 ? 20 : 0;

  // Amounts
  const recSavingsAmt = remainder > 0 ? 0.15 * remainder : 0;
  const recInvestmentsAmt = remainder > 0 ? 0.2 * remainder : 0;
  // Surplus after savings and investments
  const recSurplusAmt =
    remainder > 0
      ? Math.max(0, remainder - recSavingsAmt - recInvestmentsAmt)
      : 0;

  // Total Cashflow = Surplus after savings and investments
  const totalRecCashflowAmt = recSurplusAmt;

  // Calculate percentage for display:
  // "10% + the remaining amount percentage relative to the original monthly take-home pay"
  // If remainder > 0, this is 10 + (recSurplusAmt / TakeHome * 100)
  // If remainder == 0, it's just (grossSurplus / TakeHome * 100)
  const recommendedCashflowPct =
    monthlyTakeHomePay > 0
      ? (totalRecCashflowAmt / monthlyTakeHomePay) * 100
      : 0;

  const recommendedAllocations = {
    monthly_cashflow: totalRecCashflowAmt,
    monthly_savings: recSavingsAmt,
    monthly_investments: recInvestmentsAmt,
  };

  const zone = null;
  const status = null;
  const savingsAllowed = true;
  const investmentsAllowed = true;

  // === CUSTOM ALLOCATIONS ===
  let customAllocations = null;
  let finalUserSavingsPct = parseFloat(userSavingsPct) || 0;
  let finalUserInvestmentsPct = parseFloat(userInvestmentsPct) || 0;
  let customCashflowPct = 0;

  // Check if user has entered any valid custom savings or investment percentage
  const hasUserCustomInput =
    (!isNaN(userSavingsPct) && String(userSavingsPct) !== "") ||
    (!isNaN(userInvestmentsPct) && String(userInvestmentsPct) !== "");

  if (hasUserCustomInput) {
    finalUserSavingsPct = Math.max(0, finalUserSavingsPct);
    finalUserInvestmentsPct = Math.max(0, finalUserInvestmentsPct);

    const pctTotal = finalUserSavingsPct + finalUserInvestmentsPct;
    if (pctTotal > 100 && pctTotal > 0) {
      const scale = 100 / pctTotal;
      finalUserSavingsPct *= scale;
      finalUserInvestmentsPct *= scale;
    }

    // Amounts based on allocatable remainder
    let sAmt = remainder > 0 ? (finalUserSavingsPct / 100) * remainder : 0;
    let iAmt = remainder > 0 ? (finalUserInvestmentsPct / 100) * remainder : 0;

    sAmt = Math.floor(sAmt * 100) / 100;
    iAmt = Math.floor(iAmt * 100) / 100;

    // Custom Surplus
    const cSurplusAmt =
      remainder > 0 ? Math.max(0, remainder - sAmt - iAmt) : 0;

    // Total Custom Cashflow
    const totalCustomCashflowAmt = cSurplusAmt;

    // Custom Cashflow Percentage for display
    customCashflowPct =
      monthlyTakeHomePay > 0
        ? (totalCustomCashflowAmt / monthlyTakeHomePay) * 100
        : 0;

    customAllocations = {
      monthly_cashflow: totalCustomCashflowAmt,
      monthly_savings: sAmt,
      monthly_investments: iAmt,
    };
  } else {
    // If no custom input, default custom cashflow pct to recommended
    customCashflowPct = recommendedCashflowPct;
  }

  return {
    annual_income: annualIncome,
    province: province,
    deductions: deductions,
    total_deductions: totalDeductions,
    annual_disposable_income: annualDisposableIncome,
    monthly_disposable_income: monthlyDisposableIncome,
    living_expenses: livingExpenses,
    total_monthly_expenses: totalMonthlyExpenses,
    expenses_percentage: expensesPercentage,
    budget_zone: zone,
    status_message: status,
    savings_allowed: savingsAllowed, // Still for UI feedback/disabling inputs for recommended
    investments_allowed: investmentsAllowed, // Still for UI feedback/disabling inputs for recommended
    retirement_percentage: retirementPercentage,

    // These percentages are now of the DISPOSABLE INCOME
    recommended_savings_pct: recommendedSavingsPct,
    recommended_investments_pct: recommendedInvestmentsPct,
    recommended_cashflow_pct: recommendedCashflowPct,
    recommended_allocations: recommendedAllocations,

    // Custom allocations also use percentages of disposable income
    custom_savings_pct: finalUserSavingsPct,
    custom_investments_pct: finalUserInvestmentsPct,
    custom_cashflow_pct: customCashflowPct,
    custom_allocations: customAllocations, // This will be null if no custom input
  };
}

// Cached DOM element references.
const annualIncomeInput = document.getElementById("annualIncome");
const provinceSelect = document.getElementById("provinceSelect");
const annualIncomeError = document.getElementById("annualIncomeError");
const provinceError = document.getElementById("provinceError");
const ageRangeError = document.getElementById("ageRangeError");
const ageDropdownSelected = document.getElementById("ageDropdownSelected");
const includeRetirementCheckbox = document.getElementById("includeRetirement");
const deductonToggle = document.getElementById("deduction-toggle");
const excludeRetirementCheckbox = document.getElementById("excludeRetirement");

const retirementPercentageSection = document.getElementById(
  "retirement-percentage-section",
);
const retirementPercentageInput = document.getElementById(
  "retirementPercentage",
);
const retirementPercentageError = document.getElementById(
  "retirementPercentageError",
);

const deductionsDisposableSection = document.getElementById(
  "deductions-disposable-section",
);
// const totalAnnualDeductionsSpan = document.getElementById(
//   "totalAnnualDeductions"
// );
const deductionInputsContainer = document.getElementById(
  "deduction-inputs-container",
);
// const annualDisposableIncomeSpan = document.getElementById(
//   "annualDisposableIncome"
// );
// const monthlyDisposableIncomeSpan = document.getElementById(
//   "monthlyDisposableIncome"
// );

const currentTotalExpensesSpan = document.getElementById(
  "currentTotalExpenses",
);
const currentExpensesPercentageSpan = document.getElementById(
  "currentExpensesPercentage",
);
const currentBudgetZoneSpan = document.getElementById("currentBudgetZone");
const currentZoneMessageP = document.getElementById("currentZoneMessage");

const savingsInvestmentsSection = document.getElementById(
  "savings-investments-section",
);
const siGuidanceP = document.getElementById("si-guidance");
const savingsPercentageInput = document.getElementById("savingsPercentage");
const investmentsPercentageInput = document.getElementById(
  "investmentsPercentage",
);
const livingExpensesSection = document.getElementById(
  "living-expenses-section",
);

const annualIncomeSection = document.getElementById("annual-income-section");

const customSavingsAmountInput = document.getElementById("customSavingsAmount");
const customInvestmentsAmountInput = document.getElementById(
  "customInvestmentsAmount",
);

// Populates the province dropdown from the TAX_CONFIG object.
function initializeProvinceDropdown() {
  const provinces = TAX_CONFIG.canada.provinces;
  const dropdownList = document.getElementById("customProvinceOptions");
  const dropdownSelected = document.getElementById("dropdownSelected");

  provinceSelect.innerHTML =
    '<option value="">Choose your province...</option>';
  dropdownList.innerHTML = "";

  for (const provinceCode in provinces) {
    const province = provinces[provinceCode];

    // Add to hidden <select>
    const option = document.createElement("option");
    option.value = provinceCode;
    option.textContent = province.name;
    provinceSelect.appendChild(option);

    // Add to custom dropdown
    const li = document.createElement("li");
    li.textContent = province.name;
    li.setAttribute("data-value", provinceCode);
    li.className = "cursor-pointer px-4 py-2 hover:bg-white/10 rounded-lg";

    li.addEventListener("click", () => {
      dropdownSelected.textContent = province.name;
      provinceSelect.value = provinceCode;
      provinceSelect.dispatchEvent(new Event("change")); // Trigger change event
      toggleProvinceDropdown(); // Use the animation function to close
    });

    dropdownList.appendChild(li);
  }
}

/**
 * Creates read-only input fields to display tax deduction breakdown.
 */
function createDeductionInputs(deductions) {
  const containers = getAllElements("deduction-inputs-container");
  containers.forEach((el) => (el.innerHTML = ""));

  const deductionHexColors = {
    federal_tax: "#D6426C",
    provincial_tax: "#9D88E1",
    cpp: "#8DE188",
    ei: "#3364E1",
    retirement: "#94a3b8",
  };

  const gradientStyle = "linear-gradient(to right, #177F5B, #154D80)";

  function buildDeductionRow(key, deduction) {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between py-2";
    row.setAttribute("data-row-type", "deduction");

    const left = document.createElement("div");
    left.className = "flex items-center gap-3";

    const dot = document.createElement("span");
    dot.className = "w-3 h-3 rounded-sm";
    dot.style.backgroundColor = deductionHexColors[key] || "#94a3b8";
    left.appendChild(dot);

    const name = key === "provincial_tax" ? "Provincial tax" : deduction.name;

    const labelText = document.createElement("span");
    labelText.className = "text-gray-200 text-sm ";
    labelText.innerHTML = `${name} <span class="text-zinc-400">(${deduction.percentage.toFixed(
      2,
    )}%)</span>`;
    left.appendChild(labelText);

    if (key === "cpp" || key === "ei") {
      const infoWrap = document.createElement("span");
      infoWrap.style.position = "relative";
      infoWrap.style.display = "inline-flex";
      infoWrap.style.alignItems = "center";
      infoWrap.style.marginLeft = "6px";

      const info = document.createElement("span");
      info.className =
        "text-xs inline-flex items-center justify-center w-5 h-5 border border-slate-300 rounded-full text-slate-700 cursor-help";
      info.textContent = "i";

      const tooltip = document.createElement("div");
      tooltip.textContent =
        key === "cpp"
          ? "Canada Pension Plan contribution (up to annual max)."
          : "Employment Insurance premium (up to annual max).";
      tooltip.style.position = "absolute";
      tooltip.style.left = "24px";
      tooltip.style.top = "50%";
      tooltip.style.transform = "translateY(-50%)";
      tooltip.style.background = "#ffffff";
      tooltip.style.color = "#0f172a";
      tooltip.style.border = "1px solid #cbd5e1";
      tooltip.style.borderRadius = "6px";
      tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
      tooltip.style.padding = "6px 8px";
      tooltip.style.whiteSpace = "nowrap";
      tooltip.style.zIndex = "50";
      tooltip.style.opacity = "0";
      tooltip.style.visibility = "hidden";
      tooltip.style.transition = "opacity 150ms ease, visibility 150ms ease";
      tooltip.style.pointerEvents = "none";

      const showTooltip = () => {
        tooltip.style.opacity = "1";
        tooltip.style.visibility = "visible";
      };
      const hideTooltip = () => {
        tooltip.style.opacity = "0";
        tooltip.style.visibility = "hidden";
      };

      infoWrap.addEventListener("mouseenter", showTooltip);
      infoWrap.addEventListener("mouseleave", hideTooltip);
      infoWrap.addEventListener("click", (e) => {
        e.stopPropagation();
        tooltip.style.visibility === "visible" ? hideTooltip() : showTooltip();
      });

      infoWrap.appendChild(info);
      infoWrap.appendChild(tooltip);
      left.appendChild(infoWrap);
    }

    const dotted = document.createElement("div");
    dotted.className = "flex-1 border-t border-dashed border-emerald-200 mx-3";

    const amount = document.createElement("span");
    amount.style.background = gradientStyle;
    amount.style.webkitBackgroundClip = "text";
    amount.style.webkitTextFillColor = "transparent";
    amount.style.fontWeight = "600";
    amount.textContent = formatCurrency(deduction.amount);

    row.appendChild(left);
    row.appendChild(dotted);
    row.appendChild(amount);
    return row;
  }

  Object.entries(deductions).forEach(([key, deduction]) => {
    containers.forEach((container) => {
      container.appendChild(buildDeductionRow(key, deduction));
    });
  });

  // Summary rows: Total Annual Deduction, Annual & Monthly Take Home Pay
  const totalAmount = Object.values(deductions).reduce(
    (sum, d) => sum + d.amount,
    0,
  );
  const totalPct =
    calculatorState.annualIncome > 0
      ? (totalAmount / calculatorState.annualIncome) * 100
      : 0;

  const summaryRows = [
    { name: "Total Annual Deduction", pct: totalPct, value: totalAmount },
    {
      name: "Annual Take Home Pay",
      pct: null,
      value: calculatorState.annualDisposable,
    },
    {
      name: "Monthly Take Home Pay",
      pct: null,
      value: calculatorState.monthlyDisposableIncome,
    },
  ];

  summaryRows.forEach(({ name, pct, value }) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between py-2";
    row.setAttribute("data-row-type", "summary");

    const left = document.createElement("div");
    left.className = "flex items-center gap-2";

    // Dot for Annual Take Home Pay with your specified color
    if (name === "Annual Take Home Pay") {
      const dot = document.createElement("span");
      dot.className = "w-3 h-3 rounded-sm";
      dot.style.backgroundColor = "#FB725A";
      left.appendChild(dot);
    }

    const labelText = document.createElement("span");
    labelText.className = "text-gray-200 ";
    labelText.innerHTML =
      pct != null
        ? `${name}<span class="text-zinc-400">(${pct.toFixed(2)}%)</span>`
        : name;
    left.appendChild(labelText);

    const dotted = document.createElement("div");
    dotted.className = "flex-1 border-t border-dashed border-emerald-200 mx-3";

    const amount = document.createElement("span");
    amount.style.background = gradientStyle;
    amount.style.webkitBackgroundClip = "text";
    amount.style.webkitTextFillColor = "transparent";
    amount.style.fontWeight = "600";
    amount.textContent = formatCurrency(value);

    row.appendChild(left);
    row.appendChild(dotted);
    row.appendChild(amount);

    containers.forEach((container) =>
      container.appendChild(row.cloneNode(true)),
    );
  });

  applyDeductionsVisibility();
}
// Utility functions for validation and formatting.

function validateAnnualIncome() {
  const value = parseFloat(annualIncomeInput.value);
  if (isNaN(value) || value <= 0) {
    showError(annualIncomeError, "Please enter a valid annual income.");
    return false;
  }
  if (value > 10000000) {
    showError(
      annualIncomeError,
      "Annual income seems unrealistic. Please check.",
    );
    return false;
  }
  clearError(annualIncomeError);
  return true;
}

function validateAgeGroup() {
  const selectedAge = ageDropdownSelected.textContent;
  if (!selectedAge || selectedAge === "Choose your age range") {
    showError(ageRangeError, "Please select your age group.");
    return false;
  }
  clearError(ageRangeError);
  return true;
}

function validateProvince() {
  if (!provinceSelect.value) {
    showError(provinceError, "Please select your province.");
    return false;
  }
  clearError(provinceError);
  return true;
}

function validateRetirementPercentage() {
  if (!includeRetirementCheckbox.checked) {
    clearError(retirementPercentageError);
    return true;
  }

  const value = parseFloat(retirementPercentageInput.value);

  if (retirementPercentageInput.value === "" || isNaN(value)) {
    clearError(retirementPercentageError);
    return true;
  }

  if (value < 0 || value > 10) {
    showError(
      retirementPercentageError,
      "Contribution must be between 0% and 10%.",
    );
    // Cap the value and then trigger a recalculation
    if (value > 10) {
      retirementPercentageInput.value = "10";
    } else if (value < 0) {
      retirementPercentageInput.value = "0";
    }
    handlePrimaryInputChange(); // Trigger recalculation after capping
    return false;
  }

  clearError(retirementPercentageError);
  return true;
}

function showError(element, message) {
  element.textContent = message;
  element.style.display = "block";
  element.classList.add("text-red-500");
}

function clearError(element) {
  element.textContent = "";
  element.style.display = "none";
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function formatPercentage(percentage) {
  return isFinite(percentage) ? `${percentage.toFixed(1)}%` : "N/A";
}

// Updates UI based on user input.

/**
 * Main handler for income/province/retirement changes. Recalculates taxes and disposable income.
 */
function renderDeductionsProgressBar(deductions) {
  const segmentsEls = getAllElements("taxes-bar-segments");
  if (segmentsEls.length === 0) return;

  const gross = calculatorState.annualIncome || 0;
  if (gross <= 0) {
    segmentsEls.forEach((el) => (el.innerHTML = ""));
    return;
  }

  const hexMap = {
    federal_tax: "#D6426C",
    provincial_tax: "#9D88E1",
    cpp: "#8DE188",
    ei: "#3364E1",
    take_home: "#FB725A",
  };

  // Build ordered segments
  const orderedKeys = ["federal_tax", "provincial_tax", "cpp", "ei"];
  const widths = [];
  let totalDeductPct = 0;

  orderedKeys.forEach((key) => {
    const d = deductions[key];
    if (!d) return;
    const pct = Math.max(0, Math.min(100, (d.amount / gross) * 100));
    totalDeductPct += pct;
    widths.push({ key, pct });
  });

  const takeHomePct = Math.max(0, 100 - totalDeductPct);
  segmentsEls.forEach((el) => (el.innerHTML = ""));
  // Render deduction segments with exact hex colors
  widths.forEach(({ key, pct }) => {
    // Create segment template
    const seg = document.createElement("div");
    seg.className = "h-full";
    seg.style.background = hexMap[key] || "#64748b"; // slate fallback
    seg.style.width = `${pct}%`;

    // Append clone to all containers
    segmentsEls.forEach((el) => el.appendChild(seg.cloneNode(true)));
  });

  // Render take-home segment last with exact hex color
  const takeHomeSeg = document.createElement("div");
  takeHomeSeg.className = "h-full";
  takeHomeSeg.style.background = hexMap.take_home;
  takeHomeSeg.style.width = `${takeHomePct}%`;

  segmentsEls.forEach((el) => el.appendChild(takeHomeSeg.cloneNode(true)));
}

function handlePrimaryInputChange() {
  if (
    !validateAgeGroup() ||
    !validateAnnualIncome() ||
    !validateProvince() ||
    !validateRetirementPercentage()
  ) {
    return;
  }

  // Read inputs from DOM and update state
  calculatorState.annualIncome = parseFloat(annualIncomeInput.value);
  calculatorState.province = provinceSelect.value;
  calculatorState.ageGroup = ageDropdownSelected.textContent;
  calculatorState.retirementPercentage = includeRetirementCheckbox.checked
    ? parseFloat(retirementPercentageInput.value) || 0
    : 0;

  // Perform calculations
  const { deductions, totalDeductions } = calculateTaxes(
    calculatorState.annualIncome,
    calculatorState.province,
    calculatorState.retirementPercentage,
  );

  // Update state with calculation results
  calculatorState.annualDisposable =
    calculatorState.annualIncome - totalDeductions;
  calculatorState.monthlyDisposableIncome =
    calculatorState.annualDisposable / 12;

  // Update UI
  createDeductionInputs(deductions);
  renderDeductionsProgressBar(deductions);
  // totalAnnualDeductionsSpan.textContent = formatCurrency(totalDeductions);
  // annualDisposableIncomeSpan.textContent = formatCurrency(
  //   calculatorState.annualDisposable
  // );
  // monthlyDisposableIncomeSpan.textContent = formatCurrency(
  //   calculatorState.monthlyDisposableIncome
  // );

  // If deduction details are currently expanded, update their max-height
  const deductionInputsContainers = getAllElements(
    "deduction-inputs-container",
  );
  deductionInputsContainers.forEach((container) => {
    if (container.style.maxHeight && container.style.maxHeight !== "0px") {
      container.style.maxHeight = container.scrollHeight + "px";
    }
  });

  // Show/enable subsequent sections
  deductionsDisposableSection.classList.remove("hidden"); // Desktop sidebar

  // Show mobile taxes content (find the one NOT in desktop sidebar)
  const allTaxesContents = getAllElements("taxes-content");
  allTaxesContents.forEach((el) => {
    if (!el.closest("#deductions-disposable-section")) {
      el.classList.remove("hidden");
    }
  });

  livingExpensesSection.classList.remove("opacity-50", "pointer-events-none");
  livingExpensesSection.classList.add("animate-fade-in");

  // Trigger a full recalculation of expenses and recommendations
  handleExpenseOrAllocationChange();
  updatePrintDownloadButtonState();
}

/**
 * Handles changes from any expense or allocation input. Triggers full budget recalculation and UI update.
 */
function handleExpenseOrAllocationChange() {
  // Don't return early - let the function run to update UI even with no income

  // 1. Gather all current living expenses from inputs
  let totalExpenses = 0;
  const currentExpenses = {};
  const expenseInputs = document.querySelectorAll(
    '#living-expenses-section input[type="number"]',
  );
  if (expenseInputs && expenseInputs.length > 0) {
    expenseInputs.forEach((input) => {
      const value = parseFloat(input.value) || 0;
      // Use the id as the key (e.g., 'rent-mortgage')
      const key = input.id;
      currentExpenses[key] = value;
      totalExpenses += value;
    });
  }
  calculatorState.totalMonthlyExpensesEntered = totalExpenses;
  calculatorState.livingExpenses = currentExpenses;
  calculatorState.hasEnteredExpenses = totalExpenses > 0;

  // 2. Gather custom allocation percentages (percentages of REMAINDER after expenses)
  const useCustomAllocations = !!calculatorState.customSavingsToggleEnabled;
  const userSavingsPct = useCustomAllocations
    ? parseFloat(savingsPercentageInput.value)
    : NaN;
  const userInvestmentsPct = useCustomAllocations
    ? parseFloat(investmentsPercentageInput.value)
    : NaN;

  // 3. Perform the main budget calculation with all current data
  const budget = calculateBudget(
    calculatorState.annualIncome,
    calculatorState.province,
    calculatorState.livingExpenses,
    calculatorState.retirementPercentage,
    userSavingsPct,
    userInvestmentsPct,
  );

  // Store the current budget in calculatorState for access by other functions
  calculatorState.currentBudget = budget;

  // 4. Update all UI elements with the new budget data
  updateAllUI(budget);

  // Show mobile expenses content if expenses entered
  if (totalExpenses > 0) {
    const allExpensesContents = getAllElements("expenses-content");
    allExpensesContents.forEach((el) => {
      if (!el.closest("#deductions-disposable-section")) {
        el.classList.remove("hidden");
      }
    });
  } else {
    // Optional: Hide if 0? User didn't ask to hide on reset, but good practice.
    // Keeping it simple as per request "untill calculation is being done"
  }

  updatePrintDownloadButtonState();
}

/**
 * Updates all UI components based on the comprehensive budget object.
 */
function updateChartButtonStates(budget) {
  // Get button elements for recommended allocations
  const savingsChartBtn = document.getElementById("savingsChartBtn");
  const investmentsChartBtn = document.getElementById("investmentsChartBtn");
  const bothChartBtn = document.getElementById("bothChartBtn");

  // Get button elements for custom allocations
  const customSavingsChartBtn = document.getElementById(
    "customSavingsChartBtn",
  );
  const customInvestmentsChartBtn = document.getElementById(
    "customInvestmentsChartBtn",
  );
  const customBothChartBtn = document.getElementById("customBothChartBtn");

  // Helper function to disable/enable a button
  const setButtonState = (button, isEnabled) => {
    if (!button) return;

    if (isEnabled) {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
      button.style.pointerEvents = "auto";
    } else {
      button.disabled = true;
      button.style.opacity = "0.5";
      button.style.cursor = "not-allowed";
      button.style.pointerEvents = "none";
    }
  };

  // Check recommended allocations percentages
  const recommendedSavingsAmount =
    budget.recommended_allocations.monthly_savings;
  const recommendedInvestmentsAmount =
    budget.recommended_allocations.monthly_investments;
  const hasSavings = recommendedSavingsAmount > 0;
  const hasInvestments = recommendedInvestmentsAmount > 0;

  // Update recommended allocation buttons
  setButtonState(savingsChartBtn, hasSavings);
  setButtonState(investmentsChartBtn, hasInvestments);
  setButtonState(bothChartBtn, hasSavings && hasInvestments);

  // If all buttons are disabled, we need to handle the chart display
  if (!hasSavings && !hasInvestments) {
    // Disable all buttons
    setButtonState(savingsChartBtn, false);
    setButtonState(investmentsChartBtn, false);
    setButtonState(bothChartBtn, false);
  }

  // Check custom allocations percentages (fallback to recommended if custom is not set)
  let customSavingsAmount = 0;
  let customInvestmentsAmount = 0;

  if (budget.custom_allocations) {
    customSavingsAmount = budget.custom_allocations.monthly_savings;
    customInvestmentsAmount = budget.custom_allocations.monthly_investments;
  } else {
    // Fallback so custom tabs stay usable
    customSavingsAmount = budget.recommended_allocations.monthly_savings;
    customInvestmentsAmount =
      budget.recommended_allocations.monthly_investments;
  }

  const hasCustomSavings = customSavingsAmount > 0;
  const hasCustomInvestments = customInvestmentsAmount > 0;

  // Update custom allocation buttons (now stay enabled with fallback)
  setButtonState(customSavingsChartBtn, hasCustomSavings);
  setButtonState(customInvestmentsChartBtn, hasCustomInvestments);
  setButtonState(customBothChartBtn, hasCustomSavings && hasCustomInvestments);

  // If all custom buttons are disabled
  if (!hasCustomSavings && !hasCustomInvestments) {
    setButtonState(customSavingsChartBtn, false);
    setButtonState(customInvestmentsChartBtn, false);
    setButtonState(customBothChartBtn, false);
  }

  // Switch to an enabled button if current selection is disabled
  const currentChartType = calculatorState.compoundInterest.currentChartType;
  const customCurrentChartType =
    calculatorState.customCompoundInterest.currentChartType;

  // Handle recommended allocations chart type switching
  if (currentChartType === "investments" && !hasInvestments && hasSavings) {
    calculatorState.compoundInterest.currentChartType = "savings";
    if (savingsChartBtn) {
      const updateActiveButton = (activeBtn) => {
        [savingsChartBtn, investmentsChartBtn, bothChartBtn].forEach((btn) => {
          if (btn) {
            btn.classList.remove("chart-btn-active");
            btn.classList.add("chart-btn-inactive");
            btn.classList.remove("shadow-lg", "transform", "scale-110");
            btn.classList.add("shadow-md");
            btn.className = btn.className.replace(
              /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
              "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
            );
          }
        });
        if (activeBtn) {
          activeBtn.classList.remove("chart-btn-inactive");
          activeBtn.classList.add("chart-btn-active");
          activeBtn.classList.remove("shadow-md");
          activeBtn.classList.add("shadow-lg", "transform", "scale-110");
          activeBtn.className = activeBtn.className.replace(
            /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
            "bg-gradient-to-r from-emerald-600 to-emerald-700",
          );
        }
      };
      updateActiveButton(savingsChartBtn);
    }
  } else if (currentChartType === "both" && (!hasSavings || !hasInvestments)) {
    if (hasSavings) {
      calculatorState.compoundInterest.currentChartType = "savings";
      if (savingsChartBtn) {
        const updateActiveButton = (activeBtn) => {
          [savingsChartBtn, investmentsChartBtn, bothChartBtn].forEach(
            (btn) => {
              if (btn) {
                btn.classList.remove("chart-btn-active");
                btn.classList.add("chart-btn-inactive");
                btn.classList.remove("shadow-lg", "transform", "scale-110");
                btn.classList.add("shadow-md");
                btn.className = btn.className.replace(
                  /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
                  "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
                );
              }
            },
          );
          if (activeBtn) {
            activeBtn.classList.remove("chart-btn-inactive");
            activeBtn.classList.add("chart-btn-active");
            activeBtn.classList.remove("shadow-md");
            activeBtn.classList.add("shadow-lg", "transform", "scale-110");
            activeBtn.className = activeBtn.className.replace(
              /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
              "bg-gradient-to-r from-emerald-600 to-emerald-700",
            );
          }
        };
        updateActiveButton(savingsChartBtn);
      }
    } else if (hasInvestments) {
      calculatorState.compoundInterest.currentChartType = "investments";
      if (investmentsChartBtn) {
        const updateActiveButton = (activeBtn) => {
          [savingsChartBtn, investmentsChartBtn, bothChartBtn].forEach(
            (btn) => {
              if (btn) {
                btn.classList.remove("chart-btn-active");
                btn.classList.add("chart-btn-inactive");
                btn.classList.remove("shadow-lg", "transform", "scale-110");
                btn.classList.add("shadow-md");
                btn.className = btn.className.replace(
                  /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
                  "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
                );
              }
            },
          );
          if (activeBtn) {
            activeBtn.classList.remove("chart-btn-inactive");
            activeBtn.classList.add("chart-btn-active");
            activeBtn.classList.remove("shadow-md");
            activeBtn.classList.add("shadow-lg", "transform", "scale-110");
            activeBtn.className = activeBtn.className.replace(
              /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
              "bg-gradient-to-r from-emerald-600 to-emerald-700",
            );
          }
        };
        updateActiveButton(investmentsChartBtn);
      }
    }
  }

  // Handle custom allocations chart type switching
  if (
    customCurrentChartType === "investments" &&
    !hasCustomInvestments &&
    hasCustomSavings
  ) {
    calculatorState.customCompoundInterest.currentChartType = "savings";
    if (customSavingsChartBtn) {
      const updateCustomActiveButton = (activeBtn) => {
        [
          customSavingsChartBtn,
          customInvestmentsChartBtn,
          customBothChartBtn,
        ].forEach((btn) => {
          if (btn) {
            btn.classList.remove("chart-btn-active");
            btn.classList.add("chart-btn-inactive");
            btn.classList.remove("shadow-lg", "transform", "scale-110");
            btn.classList.add("shadow-md");
            btn.className = btn.className.replace(
              /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
              "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
            );
          }
        });
        if (activeBtn) {
          activeBtn.classList.remove("chart-btn-inactive");
          activeBtn.classList.add("chart-btn-active");
          activeBtn.classList.remove("shadow-md");
          activeBtn.classList.add("shadow-lg", "transform", "scale-110");
          activeBtn.className = activeBtn.className.replace(
            /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
            "bg-gradient-to-r from-emerald-600 to-emerald-700",
          );
        }
      };
      updateCustomActiveButton(customSavingsChartBtn);
    }
  } else if (
    customCurrentChartType === "both" &&
    (!hasCustomSavings || !hasCustomInvestments)
  ) {
    if (hasCustomSavings) {
      calculatorState.customCompoundInterest.currentChartType = "savings";
      if (customSavingsChartBtn) {
        const updateCustomActiveButton = (activeBtn) => {
          [
            customSavingsChartBtn,
            customInvestmentsChartBtn,
            customBothChartBtn,
          ].forEach((btn) => {
            if (btn) {
              btn.classList.remove("chart-btn-active");
              btn.classList.add("chart-btn-inactive");
              btn.classList.remove("shadow-lg", "transform", "scale-110");
              btn.classList.add("shadow-md");
              btn.className = btn.className.replace(
                /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
                "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
              );
            }
          });
          if (activeBtn) {
            activeBtn.classList.remove("chart-btn-inactive");
            activeBtn.classList.add("chart-btn-active");
            activeBtn.classList.remove("shadow-md");
            activeBtn.classList.add("shadow-lg", "transform", "scale-110");
            activeBtn.className = activeBtn.className.replace(
              /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
              "bg-gradient-to-r from-emerald-600 to-emerald-700",
            );
          }
        };
        updateCustomActiveButton(customSavingsChartBtn);
      }
    } else if (hasCustomInvestments) {
      calculatorState.customCompoundInterest.currentChartType = "investments";
      if (customInvestmentsChartBtn) {
        const updateCustomActiveButton = (activeBtn) => {
          [
            customSavingsChartBtn,
            customInvestmentsChartBtn,
            customBothChartBtn,
          ].forEach((btn) => {
            if (btn) {
              btn.classList.remove("chart-btn-active");
              btn.classList.add("chart-btn-inactive");
              btn.classList.remove("shadow-lg", "transform", "scale-110");
              btn.classList.add("shadow-md");
              btn.className = btn.className.replace(
                /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
                "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
              );
            }
          });
          if (activeBtn) {
            activeBtn.classList.remove("chart-btn-inactive");
            activeBtn.classList.add("chart-btn-active");
            activeBtn.classList.remove("shadow-md");
            activeBtn.classList.add("shadow-lg", "transform", "scale-110");
            activeBtn.className = activeBtn.className.replace(
              /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
              "bg-gradient-to-r from-emerald-600 to-emerald-700",
            );
          }
        };
        updateCustomActiveButton(customInvestmentsChartBtn);
      }
    }
  }
}

function updateAllUI(budget) {
  // Update category summary if it exists
  updateExpenseCategorySummary(budget);

  // Update Progress Bar Indicator
  updateProgressBar(budget.expenses_percentage);

  // Update the new simple bar under the legend
  updateExpenseHealthBar(budget);

  // Update Budget Zone coloring
  const zoneColors = {
    GREEN: { bg: "bg-green-500/20", border: "border-green-500/50" },
    MODERATE: { bg: "bg-yellow-500/20", border: "border-yellow-500/50" },
    RED: { bg: "bg-red-500/20", border: "border-red-500/50" },
    "EXTREME RED": { bg: "bg-red-900/30", border: "border-red-700/70" },
  };
  const zoneColor = budget.budget_zone
    ? zoneColors[budget.budget_zone]
    : { bg: "", border: "" };

  // Enable/disable and configure the Savings & Investments section
  // Only unlock Savings & Investments once the user has typed at least one expense
  const hasAnyExpense = budget.total_monthly_expenses > 0;
  if (hasAnyExpense) {
    if (savingsInvestmentsSection) {
      savingsInvestmentsSection.classList.remove(
        "opacity-50",
        "pointer-events-none",
      );
      savingsInvestmentsSection.classList.add("animate-fade-in");
    }
  }
  const isEnabledInputs = !!calculatorState.customSavingsToggleEnabled;
  savingsPercentageInput.disabled = !isEnabledInputs;
  investmentsPercentageInput.disabled = !isEnabledInputs;
  customSavingsAmountInput.disabled = !isEnabledInputs;
  customInvestmentsAmountInput.disabled = !isEnabledInputs;

  // Apply field appearance updates
  const isCustomToggleEnabled =
    calculatorState.customSavingsToggleEnabled || false;
  // Update field appearance based on enabled state
  const updateFieldAppearance = (input, enabled) => {
    if (enabled) {
      input.classList.remove("opacity-50", "cursor-not-allowed");
      input.classList.add("cursor-text");
    } else {
      input.classList.add("opacity-50", "cursor-not-allowed");
      input.classList.remove("cursor-text");
    }
  };

  // Apply field appearance updates
  updateFieldAppearance(
    savingsPercentageInput,
    !savingsPercentageInput.disabled,
  );
  updateFieldAppearance(
    investmentsPercentageInput,
    !investmentsPercentageInput.disabled,
  );
  updateFieldAppearance(
    customSavingsAmountInput,
    !customSavingsAmountInput.disabled,
  );
  updateFieldAppearance(
    customInvestmentsAmountInput,
    !customInvestmentsAmountInput.disabled,
  );

  if (siGuidanceP) {
    siGuidanceP.textContent =
      "For sustainable wealth creation, view our recommended allocations below.";
  }

  // Update Recommended Allocations Display (only update elements that exist)
  const recommendedSavingsAmountEl = document.getElementById(
    "recommended-savings-amount",
  );
  const recommendedInvestmentsAmountEl = document.getElementById(
    "recommended-investments-amount",
  );
  const recommendedCashflowAmountEl = document.getElementById(
    "recommended-cashflow-amount",
  );
  const recommendedSavingsPctEl = document.getElementById(
    "recommended-savings-percentage",
  );
  const recommendedInvestmentsPctEl = document.getElementById(
    "recommended-investments-percentage",
  );
  const recommendedCashflowPctEl = document.getElementById(
    "recommended-cashflow-percentage",
  );

  if (recommendedSavingsAmountEl)
    recommendedSavingsAmountEl.textContent = formatCurrency(
      budget.recommended_allocations.monthly_savings,
    );
  if (recommendedInvestmentsAmountEl)
    recommendedInvestmentsAmountEl.textContent = formatCurrency(
      budget.recommended_allocations.monthly_investments,
    );
  if (recommendedCashflowAmountEl)
    recommendedCashflowAmountEl.textContent = formatCurrency(
      budget.recommended_allocations.monthly_cashflow,
    );
  if (recommendedSavingsPctEl)
    recommendedSavingsPctEl.textContent = `${budget.recommended_savings_pct.toFixed(
      1,
    )}%`;
  if (recommendedInvestmentsPctEl)
    recommendedInvestmentsPctEl.textContent = `${budget.recommended_investments_pct.toFixed(
      1,
    )}%`;
  if (recommendedCashflowPctEl)
    recommendedCashflowPctEl.textContent = `(${budget.recommended_cashflow_pct.toFixed(
      1,
    )}%)`;

  // Auto-populate defaults when user has not entered custom values yet
  const isSavingsPctEmpty =
    savingsPercentageInput.value === "" || savingsPercentageInput.value === "0";
  const isInvestPctEmpty =
    investmentsPercentageInput.value === "" ||
    investmentsPercentageInput.value === "0";
  const isSavingsAmtEmpty =
    !customSavingsAmountInput.value ||
    customSavingsAmountInput.value.trim() === "";
  const isInvestAmtEmpty =
    !customInvestmentsAmountInput.value ||
    customInvestmentsAmountInput.value.trim() === "";

  // Check if this is the first time auto-populating (fields are empty) OR if recommended values have changed
  const currentSavingsPct = parseFloat(savingsPercentageInput.value) || 0;
  const currentInvestPct = parseFloat(investmentsPercentageInput.value) || 0;
  const recommendedSavingsPct = budget.recommended_savings_pct;
  const recommendedInvestPct = budget.recommended_investments_pct;

  // Check if recommended values have changed significantly (more than 0.01%)
  // BUT skip this check if the user is currently editing the field
  const isUserEditingSavings = savingsPercentageInput.matches(":focus");
  const isUserEditingInvestments = investmentsPercentageInput.matches(":focus");

  const hasRecommendedValuesChanged =
    (!isUserEditingSavings &&
      Math.abs(currentSavingsPct - recommendedSavingsPct) > 0.01) ||
    (!isUserEditingInvestments &&
      Math.abs(currentInvestPct - recommendedInvestPct) > 0.01);

  // Auto-populate recommended values when:
  // 1. Fields are empty/0 (first time), OR
  // 2. Recommended values have changed due to expense updates AND user hasn't entered custom values
  // 3. BUT NOT when user is actively editing (difference is due to user input, not expense changes)
  // 4. AND only when custom toggle is disabled (user wants recommended values)
  const shouldAutoPopulate =
    !calculatorState.customSavingsToggleEnabled &&
    (isSavingsPctEmpty ||
      isInvestPctEmpty ||
      isSavingsAmtEmpty ||
      isInvestAmtEmpty ||
      (hasRecommendedValuesChanged &&
        !calculatorState.hasCustomSavings &&
        !calculatorState.hasCustomInvestments));

  if (shouldAutoPopulate) {
    // Only update fields if user hasn't entered custom values (unless fields are empty)
    // AND don't update if user is currently editing that field
    if (
      (isSavingsPctEmpty && !isUserEditingSavings) ||
      (!calculatorState.hasCustomSavings &&
        hasRecommendedValuesChanged &&
        !isUserEditingSavings)
    ) {
      savingsPercentageInput.value = budget.recommended_savings_pct.toFixed(1);
    }
    if (
      (isInvestPctEmpty && !isUserEditingInvestments) ||
      (!calculatorState.hasCustomInvestments &&
        hasRecommendedValuesChanged &&
        !isUserEditingInvestments)
    ) {
      investmentsPercentageInput.value =
        budget.recommended_investments_pct.toFixed(1);
    }
    if (
      isSavingsAmtEmpty ||
      (!calculatorState.hasCustomSavings && hasRecommendedValuesChanged)
    ) {
      customSavingsAmountInput.value = Number(
        budget.recommended_allocations.monthly_savings,
      ).toFixed(2);
    }
    if (
      isInvestAmtEmpty ||
      (!calculatorState.hasCustomInvestments && hasRecommendedValuesChanged)
    ) {
      customInvestmentsAmountInput.value = Number(
        budget.recommended_allocations.monthly_investments,
      ).toFixed(2);
    }
  }

  // Store monthly investment amount in localStorage for use in investment calculator
  const monthlyInvestmentAmount = budget.custom_allocations
    ? budget.custom_allocations.monthly_investments
    : budget.recommended_allocations.monthly_investments;

  // Convert monthly to annual amount (investment calculator expects annual contributions)
  const annualInvestmentAmount = monthlyInvestmentAmount * 12;
  localStorage.setItem(
    "budgetMonthlyInvestment",
    monthlyInvestmentAmount.toString(),
  );
  localStorage.setItem(
    "budgetAnnualInvestment",
    annualInvestmentAmount.toString(),
  );

  // Update Custom Allocations Display (Amounts and Percentages)
  const userEnteredSavingsPct = parseFloat(savingsPercentageInput.value);
  const userEnteredInvestmentsPct = parseFloat(
    investmentsPercentageInput.value,
  );

  // Check if this is the first time we're showing recommended values (auto-population case)
  const isFirstTimeRecommended =
    (savingsPercentageInput.value === "" ||
      savingsPercentageInput.value === "0") &&
    (investmentsPercentageInput.value === "" ||
      investmentsPercentageInput.value === "0") &&
    budget.total_monthly_expenses > 0;

  // Custom Savings Amount - ensure synchronization with percentage
  if (
    savingsPercentageInput.value === "0" ||
    savingsPercentageInput.value === ""
  ) {
    // If percentage is explicitly 0 or empty, show $0.00
    if (!customSavingsAmountInput.matches(":focus")) {
      customSavingsAmountInput.value = (0).toFixed(2);
    }
  } else if (
    !isNaN(userEnteredSavingsPct) &&
    savingsPercentageInput.value !== "" &&
    !isFirstTimeRecommended &&
    calculatorState.customSavingsToggleEnabled
  ) {
    // Only update the amount field if the user hasn't directly edited it
    if (!customSavingsAmountInput.matches(":focus")) {
      customSavingsAmountInput.value = Number(
        budget.custom_allocations
          ? budget.custom_allocations.monthly_savings
          : 0,
      ).toFixed(2);
    }
  } else {
    // If user hasn't provided a custom percentage, keep showing recommended amount
    if (!customSavingsAmountInput.matches(":focus")) {
      customSavingsAmountInput.value = Number(
        budget.recommended_allocations.monthly_savings || 0,
      ).toFixed(2);
    }
  }

  // Custom Investments Amount - ensure synchronization with percentage
  if (
    investmentsPercentageInput.value === "0" ||
    investmentsPercentageInput.value === ""
  ) {
    // If percentage is explicitly 0 or empty, show $0.00
    if (!customInvestmentsAmountInput.matches(":focus")) {
      customInvestmentsAmountInput.value = (0).toFixed(2);
    }
  } else if (
    !isNaN(userEnteredInvestmentsPct) &&
    investmentsPercentageInput.value !== "" &&
    !isFirstTimeRecommended &&
    calculatorState.customSavingsToggleEnabled
  ) {
    // Only update the amount field if the user hasn't directly edited it
    if (!customInvestmentsAmountInput.matches(":focus")) {
      customInvestmentsAmountInput.value = Number(
        budget.custom_allocations
          ? budget.custom_allocations.monthly_investments
          : 0,
      ).toFixed(2);
    }
  } else {
    // If user hasn't provided a custom percentage, keep showing recommended amount
    if (!customInvestmentsAmountInput.matches(":focus")) {
      customInvestmentsAmountInput.value = Number(
        budget.recommended_allocations.monthly_investments || 0,
      ).toFixed(2);
    }
  }

  if (!calculatorState.customSavingsToggleEnabled) {
    const remainder = Math.max(
      0,
      (budget.monthly_disposable_income || 0) -
        (budget.total_monthly_expenses || 0),
    );
    const sPctVal = parseFloat(savingsPercentageInput.value) || 0;
    const iPctVal = parseFloat(investmentsPercentageInput.value) || 0;

    // Update savings amount based on percentage (including 0%)
    if (!customSavingsAmountInput.matches(":focus")) {
      if (sPctVal > 0) {
        const sAmtVal = (sPctVal / 100) * remainder;
        customSavingsAmountInput.value = Number(sAmtVal).toFixed(2);
      } else {
        customSavingsAmountInput.value = (0).toFixed(2);
      }
    }

    // Update investments amount based on percentage (including 0%)
    if (!customInvestmentsAmountInput.matches(":focus")) {
      if (iPctVal > 0) {
        const iAmtVal = (iPctVal / 100) * remainder;
        customInvestmentsAmountInput.value = Number(iAmtVal).toFixed(2);
      } else {
        customInvestmentsAmountInput.value = (0).toFixed(2);
      }
    }
  }

  // Custom Cashflow Amount and Percentage
  const displayCashflowAmt = budget.custom_allocations
    ? budget.custom_allocations.monthly_cashflow
    : budget.recommended_allocations.monthly_cashflow;
  const displayCashflowPct = budget.custom_allocations
    ? budget.custom_cashflow_pct
    : budget.recommended_cashflow_pct;
  document.getElementById("customCashflowAmount").textContent = formatCurrency(
    displayCashflowAmt || 0,
  );
  document.getElementById("customCashflowPercentage").textContent = `(${(
    displayCashflowPct || 0
  ).toFixed(1)}%)`;

  // === START: CTA DISPLAY LOGIC ===
  const ctaSection = document.getElementById("recommended-cashflow-cta");
  const ctaMessage = document.getElementById("cta-message");
  const MIN_CASHFLOW_PCT = 10;

  if (budget.monthly_disposable_income > 0) {
    ctaSection.classList.remove("hidden");

    const cashflowToCheck = budget.custom_allocations
      ? budget.custom_allocations.monthly_cashflow
      : budget.recommended_allocations.monthly_cashflow;
    const cashflowPctToCheck = budget.custom_allocations
      ? budget.custom_cashflow_pct
      : budget.recommended_cashflow_pct;

    if (cashflowPctToCheck < MIN_CASHFLOW_PCT) {
      // Caution message
      ctaMessage.innerHTML = `<strong class="font-semibold">Great Job, lets walk you through a clear next step to build sustainable wealth</strong>`;

      // Remove any background colors; only use border for emphasis
      ctaSection.classList.remove("bg-white/5", "bg-red-900/30");
      ctaSection.classList.remove("border-white/10");
      ctaSection.classList.add("border-red-500/50");
    } else {
      // Standard message
      ctaMessage.innerHTML = `<strong class="font-semibold">Great Job, lets walk you through a clear next step to build sustainable wealth</strong>`;

      // Remove any background colors; only use border for normal state
      ctaSection.classList.remove("bg-white/5", "bg-red-900/30");
      ctaSection.classList.remove("border-red-500/50");
      ctaSection.classList.add("border-white/10");
    }
  } else {
    ctaSection.classList.add("hidden");
  }
  // === END: CTA DISPLAY LOGIC ===

  // Update individual expense percentage labels
  updateExpensePercentageLabels(budget.monthly_disposable_income);

  // Update chart button states based on budget data
  updateChartButtonStates(budget);
  updateProjectionChart();

  // Render all custom projection charts stacked
  scheduleChartsUpdate({ force: false });
}

/**
 * Updates percentage display for each expense item and category total.
 */
function updateExpensePercentageLabels(monthlyDisposableIncome) {
  if (monthlyDisposableIncome <= 0) return;

  const categories = {
    housing: [
      "rent-mortgage",
      "electricity",
      "water",
      "gas-heating",
      "home-insurance",
      "housing-others",
    ],
    transportation: [
      "car-payment",
      "gas-fuel",
      "car-insurance",
      "public-transit",
      "car-maintenance",
      "transport-others",
    ],
    loans: [
      "student-loans",
      "credit-cards",
      "personal-loans",
      "life-insurance",
      "line-of-credit",
      "loan-others",
    ],
    living: [
      "groceries",
      "phone-bills",
      "subscriptions",
      "internet",
      "clothing",
      "living-others",
    ],
    miscellaneous: [
      "healthcare",
      "entertainment",
      "dining-out",
      "pets",
      "gifts-donations",
      "misc-others",
    ],
    children: [
      "school-tuition",
      "childcare",
      "school-supplies",
      "kids-activities",
      "education-savings",
      "children-others",
    ],
  };

  for (const categoryName in categories) {
    let categoryTotal = 0;
    categories[categoryName].forEach((inputId) => {
      const input = document.getElementById(inputId);
      const value = parseFloat(input.value) || 0;
      categoryTotal += value;
      const percentageSpan = document.getElementById(
        `${inputId.replace(/-/g, "_")}-percentage`,
      );
      if (percentageSpan) {
        if (value > 0) {
          const percentage = (value / monthlyDisposableIncome) * 100;
          percentageSpan.textContent = `(${formatPercentage(percentage)})`;
        } else {
          percentageSpan.textContent = "";
        }
      }
    });

    const categoryTotalSpan = document.getElementById(`${categoryName}-total`);
    if (categoryTotalSpan) {
      if (categoryTotal > 0) {
        const totalPercentage = (categoryTotal / monthlyDisposableIncome) * 100;
        categoryTotalSpan.textContent = `${formatCurrency(
          categoryTotal,
        )} (${formatPercentage(totalPercentage)} of your Take-Home Pay)`;
      } else {
        categoryTotalSpan.textContent = "";
      }
    }
  }
}

// Attaches event listeners to DOM elements.

function setupEventListeners() {
  // Primary income and deduction inputs
  annualIncomeInput.addEventListener("focus", switchToTaxesTab);
  annualIncomeInput.addEventListener("input", () => {
    switchToTaxesTab();
    handlePrimaryInputChange();
  });
  provinceSelect.addEventListener("change", () => {
    switchToTaxesTab();
    handlePrimaryInputChange();
  });
  includeRetirementCheckbox.addEventListener("change", () => {
    switchToTaxesTab();
    toggleRetirementSection(true);
    handlePrimaryInputChange();
  });
  excludeRetirementCheckbox.addEventListener("change", () => {
    switchToTaxesTab();
    toggleRetirementSection(false);
    if (excludeRetirementCheckbox.checked) {
      retirementPercentageInput.value = "";
    }
    handlePrimaryInputChange();
  });
  retirementPercentageInput.addEventListener("input", () => {
    switchToTaxesTab();
    if (validateRetirementPercentage()) {
      handlePrimaryInputChange();
    }
  });

  // Custom Allocations Toggle Button
  const toggleCustomAllocationsBtn = document.getElementById(
    "toggleCustomAllocationsBtn",
  );

  const customAllocationsSection = document.getElementById(
    "customAllocationsSection",
  );

  // Ensure visible by default; no toggle behavior
  if (customAllocationsSection) {
    customAllocationsSection.classList.remove("hidden");
    customAllocationsSection.style.overflow = "visible";
    customAllocationsSection.style.maxHeight = "none";
    customAllocationsSection.style.opacity = "1";
  }

  if (toggleCustomAllocationsBtn && customAllocationsSection) {
    toggleCustomAllocationsBtn.addEventListener("click", () => {
      switchToSaveTab();
      const isHidden = customAllocationsSection.classList.contains("hidden");

      if (isHidden) {
        // Show with animation
        customAllocationsSection.classList.remove("hidden");
        // Set a small delay to ensure the hidden class is removed first
        setTimeout(() => {
          customAllocationsSection.style.maxHeight = "5000px"; // Large enough to contain all content
          customAllocationsSection.style.opacity = "1";
        }, 10);

        toggleCustomAllocationsBtn.innerHTML = `
          <span style="color: white; font-weight: 500">Hide Custom Allocations</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
          </svg>
        `;
      } else {
        // Hide with animation
        customAllocationsSection.style.maxHeight = "0";
        customAllocationsSection.style.opacity = "0";

        // Add the hidden class after animation completes
        setTimeout(() => {
          customAllocationsSection.classList.add("hidden");
        }, 500); // Match the transition duration

        toggleCustomAllocationsBtn.innerHTML = `
          <span>Enter Custom Allocations</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        `;
      }
    });
  }

  // All living expense inputs
  const expenseInputs = document.querySelectorAll(
    '#living-expenses-section input[type="number"]',
  );
  expenseInputs.forEach((input) => {
    input.addEventListener("focus", switchToExpensesTab);
    input.addEventListener("input", () => {
      if (input.value.length > 10) {
        input.value = input.value.slice(0, 10);
      }
      switchToExpensesTab();
      if (calculatorState.customSavingsToggleEnabled) {
        const customSavingsToggleEl = document.getElementById(
          "customSavingsToggle",
        );
        const siToggleTextEl = document.getElementById("si-toggle-text");
        if (customSavingsToggleEl) {
          customSavingsToggleEl.checked = false;
          calculatorState.customSavingsToggleEnabled = false;
          if (siToggleTextEl) {
            siToggleTextEl.textContent = "Set your custom allocations";
          }
          customSavingsToggleEl.dispatchEvent(new Event("change"));
        }
      }
      handleExpenseChangeWithChartSync();
    });
  });

  if (livingExpensesSection) {
    livingExpensesSection.addEventListener("click", switchToExpensesTab);
  }

  if (savingsInvestmentsSection) {
    savingsInvestmentsSection.addEventListener("click", switchToSaveTab);
  }

  if (annualIncomeSection) {
    annualIncomeSection.addEventListener("click", switchToTaxesTab);
  }

  if (savingsInvestmentsSection && livingExpensesSection) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const livingBottom =
            livingExpensesSection.offsetTop +
            livingExpensesSection.offsetHeight;
          const viewportCenter = window.scrollY + window.innerHeight / 2;
          if (entry.isIntersecting && viewportCenter > livingBottom) {
            collapseAllExpenses();
          }
        });
      },
      { threshold: 0.25 },
    );
    observer.observe(savingsInvestmentsSection);
  }

  if (savingsInvestmentsSection && livingExpensesSection) {
    const maybeCollapseExpensesOnScroll = () => {
      const savingsRect = savingsInvestmentsSection.getBoundingClientRect();
      const livingRect = livingExpensesSection.getBoundingClientRect();
      const nearSavings = savingsRect.top <= window.innerHeight * 0.65;
      const pastLiving = livingRect.bottom <= 0;
      if (nearSavings || pastLiving) collapseAllExpenses();
    };
    window.addEventListener("scroll", maybeCollapseExpensesOnScroll, {
      passive: true,
    });
    window.addEventListener("resize", maybeCollapseExpensesOnScroll);
  }

  // Income section collapse logic
  const incomeToggleBtn = document.getElementById("income-section-toggle");
  if (incomeToggleBtn) {
    incomeToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleIncomeSection();
    });
  }

  if (livingExpensesSection && annualIncomeSection) {
    const maybeCollapseIncomeOnScroll = () => {
      const livingRect = livingExpensesSection.getBoundingClientRect();
      // Collapse income when scrolling down to expenses (living expenses near top of viewport)
      const nearLiving = livingRect.top <= window.innerHeight * 0.5;

      if (nearLiving) {
        collapseIncomeSection();
      }
    };

    window.addEventListener("scroll", maybeCollapseIncomeOnScroll, {
      passive: true,
    });
    window.addEventListener("resize", maybeCollapseIncomeOnScroll);
  }

  // Custom savings and investments inputs
  savingsPercentageInput.addEventListener("focus", switchToSaveTab);
  savingsPercentageInput.addEventListener("input", () => {
    // Process input regardless of toggle state for real-time updates
    switchToSaveTab();

    const budget = calculatorState.currentBudget;
    if (budget && budget.monthly_disposable_income > 0) {
      const mdi = budget.monthly_disposable_income;
      const expenses = budget.total_monthly_expenses || 0;
      const remainder = Math.max(0, mdi - expenses);
      const maxPctTotal = remainder > 0 ? 100 : 0;
      const otherPct = parseFloat(investmentsPercentageInput.value) || 0;
      let sPct = parseFloat(savingsPercentageInput.value) || 0;
      if (sPct + otherPct > maxPctTotal) {
        sPct = Math.max(0, maxPctTotal - otherPct);
        savingsPercentageInput.value = sPct.toFixed(1);
        const allocErr = document.getElementById("allocationError");
        if (allocErr) {
          allocErr.classList.remove("hidden");
          allocErr.textContent =
            "Total allocations cannot exceed remaining amount after expenses.";
        }
      } else {
        const allocErr = document.getElementById("allocationError");
        if (allocErr) allocErr.classList.add("hidden");
      }
    }

    // Only set custom flag if user enters a non-empty value
    if (savingsPercentageInput.value && savingsPercentageInput.value !== "0") {
      calculatorState.hasCustomSavings = true;
    } else {
      calculatorState.hasCustomSavings = false; // Field is cleared
    }

    // Update charts immediately for real-time rendering (use debounced version)
    debouncedChartUpdate();

    // Force refresh if percentage dropped to 0 to clear cached data
    if (
      savingsPercentageInput.value === "0" ||
      savingsPercentageInput.value === ""
    ) {
      setTimeout(() => {
        forceRefreshCharts();
      }, 150);
    }

    // Don't recalculate immediately if user is actively typing (debounce)
    clearTimeout(window.savingsInputTimeout);
    window.savingsInputTimeout = setTimeout(() => {
      handleExpenseOrAllocationChange();
    }, 300); // 300ms delay
  });
  investmentsPercentageInput.addEventListener("focus", switchToSaveTab);
  investmentsPercentageInput.addEventListener("input", () => {
    // Process input regardless of toggle state for real-time updates
    switchToSaveTab();

    const budget = calculatorState.currentBudget;
    if (budget && budget.monthly_disposable_income > 0) {
      const mdi = budget.monthly_disposable_income;
      const expenses = budget.total_monthly_expenses || 0;
      const remainder = Math.max(0, mdi - expenses);
      const maxPctTotal = remainder > 0 ? 100 : 0;
      const otherPct = parseFloat(savingsPercentageInput.value) || 0;
      let iPct = parseFloat(investmentsPercentageInput.value) || 0;
      if (iPct + otherPct > maxPctTotal) {
        iPct = Math.max(0, maxPctTotal - otherPct);
        investmentsPercentageInput.value = iPct.toFixed(1);
        const allocErr = document.getElementById("allocationError");
        if (allocErr) {
          allocErr.classList.remove("hidden");
          allocErr.textContent =
            "Total allocations cannot exceed remaining amount after expenses.";
        }
      } else {
        const allocErr = document.getElementById("allocationError");
        if (allocErr) allocErr.classList.add("hidden");
      }
    }

    // Only set custom flag if user enters a non-empty value
    if (
      investmentsPercentageInput.value &&
      investmentsPercentageInput.value !== "0"
    ) {
      calculatorState.hasCustomInvestments = true;
    } else {
      calculatorState.hasCustomInvestments = false; // Field is cleared
    }

    // Update charts immediately for real-time rendering (use debounced version)
    debouncedChartUpdate();

    // Force refresh if percentage dropped to 0 to clear cached data
    if (
      investmentsPercentageInput.value === "0" ||
      investmentsPercentageInput.value === ""
    ) {
      setTimeout(() => {
        forceRefreshCharts();
      }, 150);
    }

    // Don't recalculate immediately if user is actively typing (debounce)
    clearTimeout(window.investmentsInputTimeout);
    window.investmentsInputTimeout = setTimeout(() => {
      handleExpenseOrAllocationChange();
    }, 300); // 300ms delay
  });

  // Custom amount inputs
  customSavingsAmountInput.addEventListener("focus", switchToSaveTab);
  customSavingsAmountInput.addEventListener("input", (e) => {
    // Process input regardless of toggle state for real-time updates
    switchToSaveTab();
    // Only set custom flag if user enters a non-empty value
    if (
      customSavingsAmountInput.value &&
      customSavingsAmountInput.value !== ""
    ) {
      calculatorState.hasCustomSavings = true;
    } else {
      calculatorState.hasCustomSavings = false; // Field is cleared
    }
    const budget = calculatorState.currentBudget;
    if (budget && budget.monthly_disposable_income > 0) {
      const mdi = budget.monthly_disposable_income;
      const expenses = budget.total_monthly_expenses || 0;
      const available = Math.max(0, mdi - expenses);
      const otherAmt =
        parseFloat(customInvestmentsAmountInput.value || "") || 0;
      let sAmt = parseFloat(customSavingsAmountInput.value || "") || 0;
      if (sAmt + otherAmt > available) {
        sAmt = Math.max(0, available - otherAmt);
        customSavingsAmountInput.value = Number(sAmt).toFixed(2);
        const allocErr = document.getElementById("allocationError");
        if (allocErr) {
          allocErr.classList.remove("hidden");
          allocErr.textContent =
            "Total allocations cannot exceed remaining amount after expenses.";
        }
      } else {
        const allocErr = document.getElementById("allocationError");
        if (allocErr) allocErr.classList.add("hidden");
      }
    }
    handleCustomAmountChange(e);

    // Update charts immediately for real-time rendering (use debounced version)
    debouncedChartUpdate();
  });
  customInvestmentsAmountInput.addEventListener("focus", switchToSaveTab);
  customInvestmentsAmountInput.addEventListener("input", (e) => {
    // Process input regardless of toggle state for real-time updates
    switchToSaveTab();
    // Only set custom flag if user enters a non-empty value
    if (
      customInvestmentsAmountInput.value &&
      customInvestmentsAmountInput.value !== ""
    ) {
      calculatorState.hasCustomInvestments = true;
    } else {
      calculatorState.hasCustomInvestments = false; // Field is cleared
    }
    const budget2 = calculatorState.currentBudget;
    if (budget2 && budget2.monthly_disposable_income > 0) {
      const mdi = budget2.monthly_disposable_income;
      const expenses = budget2.total_monthly_expenses || 0;
      const available = Math.max(0, mdi - expenses);
      const otherAmt = parseFloat(customSavingsAmountInput.value || "") || 0;
      let iAmt = parseFloat(customInvestmentsAmountInput.value || "") || 0;
      if (iAmt + otherAmt > available) {
        iAmt = Math.max(0, available - otherAmt);
        customInvestmentsAmountInput.value = Number(iAmt).toFixed(2);
        const allocErr = document.getElementById("allocationError");
        if (allocErr) {
          allocErr.classList.remove("hidden");
          allocErr.textContent =
            "Total allocations cannot exceed remaining amount after expenses.";
        }
      } else {
        const allocErr = document.getElementById("allocationError");
        if (allocErr) allocErr.classList.add("hidden");
      }
    }
    handleCustomAmountChange(e);

    // Update charts immediately for real-time rendering (use debounced version)
    debouncedChartUpdate();
  });

  // Custom Savings Toggle functionality
  const customSavingsToggle = document.getElementById("customSavingsToggle");
  const siToggleText = document.getElementById("si-toggle-text");

  if (customSavingsToggle) {
    customSavingsToggle.addEventListener("change", () => {
      calculatorState.customSavingsToggleEnabled = customSavingsToggle.checked;

      // Update toggle text
      if (siToggleText) {
        siToggleText.textContent = customSavingsToggle.checked
          ? "Switch to recommended allocations"
          : "Set your custom allocations";
      }

      // Enable/disable input fields based on toggle state
      const isEnabled = customSavingsToggle.checked;
      savingsPercentageInput.disabled = !isEnabled;
      investmentsPercentageInput.disabled = !isEnabled;
      customSavingsAmountInput.disabled = !isEnabled;
      customInvestmentsAmountInput.disabled = !isEnabled;

      // Update field appearance based on enabled state
      const updateFieldAppearance = (input, enabled) => {
        if (enabled) {
          input.classList.remove("opacity-50", "cursor-not-allowed");
          input.classList.add("cursor-text");
        } else {
          input.classList.add("opacity-50", "cursor-not-allowed");
          input.classList.remove("cursor-text");
        }
      };

      updateFieldAppearance(savingsPercentageInput, isEnabled);
      updateFieldAppearance(investmentsPercentageInput, isEnabled);
      updateFieldAppearance(customSavingsAmountInput, isEnabled);
      updateFieldAppearance(customInvestmentsAmountInput, isEnabled);

      // If toggle is turned off, reset to recommended numbers
      if (!isEnabled) {
        const budget = calculatorState.currentBudget;
        if (budget) {
          // Clear custom flags since we're resetting to recommended
          calculatorState.hasCustomSavings = false;
          calculatorState.hasCustomInvestments = false;

          // Set inputs to recommended percentages
          savingsPercentageInput.value =
            budget.recommended_savings_pct.toFixed(1);
          investmentsPercentageInput.value =
            budget.recommended_investments_pct.toFixed(1);

          // Set amount inputs to recommended monthly amounts
          customSavingsAmountInput.value = Number(
            budget.recommended_allocations.monthly_savings,
          ).toFixed(2);
          customInvestmentsAmountInput.value = Number(
            budget.recommended_allocations.monthly_investments,
          ).toFixed(2);

          // Recalculate with these values to update charts and cashflow
          handleExpenseOrAllocationChange();

          // Update charts immediately after toggle change
          updateAllCustomProjectionCharts();
        }
      }
    });

    // Initialize toggle state - disabled by default (recommended values mode)
    customSavingsToggle.checked = false;
    calculatorState.customSavingsToggleEnabled = false;
    if (siToggleText) {
      siToggleText.textContent = "Set your custom allocations";
    }
    savingsPercentageInput.disabled = true;
    investmentsPercentageInput.disabled = true;
    customSavingsAmountInput.disabled = true;
    customInvestmentsAmountInput.disabled = true;
    savingsPercentageInput.classList.add("opacity-50", "cursor-not-allowed");
    investmentsPercentageInput.classList.add(
      "opacity-50",
      "cursor-not-allowed",
    );
    customSavingsAmountInput.classList.add("opacity-50", "cursor-not-allowed");
    customInvestmentsAmountInput.classList.add(
      "opacity-50",
      "cursor-not-allowed",
    );
    savingsPercentageInput.classList.remove("cursor-text");
    investmentsPercentageInput.classList.remove("cursor-text");
    customSavingsAmountInput.classList.remove("cursor-text");
    customInvestmentsAmountInput.classList.remove("cursor-text");
  }

  // Chart projection buttons
  const savingsChartBtn = document.getElementById("savingsChartBtn");
  const investmentsChartBtn = document.getElementById("investmentsChartBtn");
  const bothChartBtn = document.getElementById("bothChartBtn");
  const projectionYearsInput = document.getElementById("projectionYears");
  const projectionRateInput = document.getElementById("projectionRate");

  if (savingsChartBtn && investmentsChartBtn && bothChartBtn) {
    // Helper function to update active button styling
    const updateActiveButton = (activeBtn) => {
      [savingsChartBtn, investmentsChartBtn, bothChartBtn].forEach((btn) => {
        btn.classList.remove("chart-btn-active");
        btn.classList.add("chart-btn-inactive");
        // Remove active styling classes
        btn.classList.remove("shadow-lg", "transform", "scale-110");
        btn.classList.add("shadow-md");
        btn.className = btn.className.replace(
          /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
          "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
        );
      });
      activeBtn.classList.remove("chart-btn-inactive");
      activeBtn.classList.add("chart-btn-active");
      // Add active styling classes
      activeBtn.classList.remove("shadow-md");
      activeBtn.classList.add("shadow-lg", "transform", "scale-110");
      activeBtn.className = activeBtn.className.replace(
        /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
        "bg-gradient-to-r from-emerald-600 to-emerald-700",
      );
    };

    savingsChartBtn.addEventListener("click", () => {
      calculatorState.compoundInterest.currentChartType = "savings";
      updateActiveButton(savingsChartBtn);
      updateProjectionChart();
    });

    investmentsChartBtn.addEventListener("click", () => {
      calculatorState.compoundInterest.currentChartType = "investments";
      updateActiveButton(investmentsChartBtn);
      updateProjectionChart();
    });

    bothChartBtn.addEventListener("click", () => {
      calculatorState.compoundInterest.currentChartType = "both";
      updateActiveButton(bothChartBtn);
      updateProjectionChart();
    });

    // Add event listeners for projection parameters
    if (projectionYearsInput) {
      projectionYearsInput.addEventListener("input", () => {
        const years = parseInt(projectionYearsInput.value) || 5;
        calculatorState.compoundInterest.years = Math.max(
          1,
          Math.min(50, years),
        );
        updateProjectionChart();
      });
    }

    if (projectionRateInput) {
      projectionRateInput.addEventListener("input", () => {
        const rate = parseFloat(projectionRateInput.value) || 6;
        calculatorState.compoundInterest.returnRate = Math.max(
          0,
          Math.min(20, rate),
        );
        updateProjectionChart();
      });
    }
  }

  // Custom Chart projection buttons
  const customSavingsChartBtn = document.getElementById(
    "customSavingsChartBtn",
  );
  const customInvestmentsChartBtn = document.getElementById(
    "customInvestmentsChartBtn",
  );
  const customBothChartBtn = document.getElementById("customBothChartBtn");
  // Custom projection now uses same parameters as recommended allocations
  // No need for separate input elements

  if (
    customSavingsChartBtn &&
    customInvestmentsChartBtn &&
    customBothChartBtn
  ) {
    // NEW: tabbed view toggling
    const customViews = {
      savings: document.getElementById("customSavingsView"),
      investments: document.getElementById("customInvestmentsView"),
      both: document.getElementById("customBothView"),
    };
    const showCustomView = (key) => {
      Object.entries(customViews).forEach(([name, el]) => {
        if (el) el.classList.toggle("hidden", name !== key);
      });
    };

    // Helper function to update active button styling for custom buttons
    const updateCustomActiveButton = (activeBtn) => {
      [
        customSavingsChartBtn,
        customInvestmentsChartBtn,
        customBothChartBtn,
      ].forEach((btn) => {
        btn.classList.remove("chart-btn-active");
        btn.classList.add("chart-btn-inactive");
        // Remove active styling classes
        btn.classList.remove("shadow-lg", "transform", "scale-110");
        btn.classList.add("shadow-md");
        btn.className = btn.className.replace(
          /bg-gradient-to-r from-emerald-600 to-emerald-700/g,
          "bg-gradient-to-r from-emerald-400/60 to-emerald-500/60",
        );
      });
      activeBtn.classList.remove("chart-btn-inactive");
      activeBtn.classList.add("chart-btn-active");
      // Add active styling classes
      activeBtn.classList.remove("shadow-md");
      activeBtn.classList.add("shadow-lg", "transform", "scale-110");
      activeBtn.className = activeBtn.className.replace(
        /bg-gradient-to-r from-emerald-400\/60 to-emerald-500\/60/g,
        "bg-gradient-to-r from-emerald-600 to-emerald-700",
      );
    };

    customSavingsChartBtn.addEventListener("click", () => {
      calculatorState.customCompoundInterest.currentChartType = "savings";
      updateCustomActiveButton(customSavingsChartBtn);
      showCustomView("savings");
      updateCustomProjectionChart();
    });

    customInvestmentsChartBtn.addEventListener("click", () => {
      calculatorState.customCompoundInterest.currentChartType = "investments";
      updateCustomActiveButton(customInvestmentsChartBtn);
      showCustomView("investments");
      updateCustomProjectionChart();
    });

    customBothChartBtn.addEventListener("click", () => {
      calculatorState.customCompoundInterest.currentChartType = "both";
      updateCustomActiveButton(customBothChartBtn);
      showCustomView("both");
      updateCustomProjectionChart();
    });

    // Default visible tab
    showCustomView("savings");

    // Custom projection now uses same parameters as recommended allocations
    // No separate event listeners needed
  }

  // UI Toggles
  const dropdownBtn = document.getElementById("dropdownBtn");
  const dropdownList = document.getElementById("customProvinceOptions");
  dropdownBtn.addEventListener("click", () => {
    switchToTaxesTab();
    toggleProvinceDropdown();
  });

  // deductonToggle.addEventListener("click", () => {
  //   toggleDeductionInputs();
  // });

  const toggleAllExpensesButton = document.getElementById(
    "toggle-all-expenses",
  );
  if (toggleAllExpensesButton) {
    toggleAllExpensesButton.addEventListener("click", toggleAllExpenses);
  }

  //this is the age drop down list
  const ageDropdownBtn = document.getElementById("ageDropdownBtn");
  const ageDropdownList = document.getElementById("customAgeOptions");

  // Toggle age dropdown visibility
  function toggleAgeDropdown() {
    const isOpen =
      ageDropdownList.style.maxHeight &&
      ageDropdownList.style.maxHeight !== "0px";
    if (isOpen) {
      ageDropdownList.style.maxHeight = "0";
      ageDropdownList.style.opacity = "0";
    } else {
      ageDropdownList.style.maxHeight = ageDropdownList.scrollHeight + "px";
      ageDropdownList.style.opacity = "1";
    }
  }

  // Handle dropdown toggle
  ageDropdownBtn.addEventListener("click", () => {
    switchToTaxesTab();
    toggleAgeDropdown();
  });

  // Handle selecting an age option
  const ageOptions = ageDropdownList.querySelectorAll("li");
  ageOptions.forEach((option) => {
    option.addEventListener("click", () => {
      document.getElementById("ageDropdownSelected").textContent =
        option.textContent;
      toggleAgeDropdown();
      switchToTaxesTab();
      handlePrimaryInputChange(); // Trigger validation and recalculation
    });
  });
  // Popup logic
  const infoButton = document.getElementById("infoButton");
  const infoPopup = document.getElementById("infoPopup");
  const closePopup = document.getElementById("closePopup");

  // New AllocationsBtn popup logic
  const allocationsBtn = document.getElementById("AllocationsBtn");
  const infoPopup2 = document.getElementById("infoPopup2");
  const closePopup2 = document.getElementById("closePopup2");

  if (infoButton) {
    infoButton.addEventListener("click", () => {
      infoPopup.classList.remove("hidden");
    });
  }
  if (closePopup) {
    closePopup.addEventListener("click", () =>
      infoPopup.classList.add("hidden"),
    );
  }
  if (infoPopup) {
    infoPopup.addEventListener("click", (e) => {
      if (e.target === infoPopup) infoPopup.classList.add("hidden");
    });
  }
  // Add event listeners for the new AllocationsBtn modal
  if (allocationsBtn) {
    allocationsBtn.addEventListener("click", () =>
      infoPopup2.classList.remove("hidden"),
    );
  }

  if (closePopup2) {
    closePopup2.addEventListener("click", () =>
      infoPopup2.classList.add("hidden"),
    );
  }

  if (infoPopup2) {
    infoPopup2.addEventListener("click", (e) => {
      if (e.target === infoPopup2) infoPopup2.classList.add("hidden");
    });
  }
}

// Function to toggle category expansion/collapse
function toggleCategory(categoryName) {
  const allCategoryContents = document.querySelectorAll(
    ".expense-category .category-content",
  );
  const allCategoryArrows = document.querySelectorAll(
    ".expense-category .category-arrow",
  );
  const allCategoryButtons = document.querySelectorAll(
    ".expense-category .category-toggle",
  );

  const currentButton = document.querySelector(
    `[onclick="toggleCategory('${categoryName}')"]`,
  );
  const currentContent = currentButton.nextElementSibling;
  const currentArrow = currentButton.querySelector(".category-arrow");
  const isExpanded =
    currentContent.style.maxHeight && currentContent.style.maxHeight !== "0px";

  // First, close all categories
  allCategoryContents.forEach((content, index) => {
    content.style.maxHeight = "0px";
    allCategoryArrows[index].style.transform = "rotate(0deg)";
  });

  // If the clicked category was not already expanded, open it
  if (!isExpanded) {
    currentContent.style.maxHeight = currentContent.scrollHeight + "px";
    currentArrow.style.transform = "rotate(180deg)";
  }
  // If it was expanded, the above loop already closed it.
}

// Function to toggle all expense categories at once
function toggleAllExpenses() {
  const toggleAllButton = document.getElementById("toggle-all-expenses");
  const label = document.getElementById("toggle-all-expenses-text");
  const expenseCategories = document.querySelectorAll(".expense-category");

  const isExpanding = label
    ? label.textContent.trim().toLowerCase().includes("expand")
    : true; // default to expanding if label not found

  expenseCategories.forEach((category) => {
    const categoryContent = category.querySelector(".category-content");
    const arrow = category.querySelector(".category-arrow");
    const isExpanded =
      categoryContent.style.maxHeight &&
      categoryContent.style.maxHeight !== "0px";

    if (isExpanding && !isExpanded) {
      categoryContent.style.maxHeight = categoryContent.scrollHeight + "px";
      arrow.style.transform = "rotate(180deg)";
    } else if (!isExpanding && isExpanded) {
      categoryContent.style.maxHeight = "0px";
      arrow.style.transform = "rotate(0deg)";
    }
  });

  // Update only the label text so icons never disappear
  if (label) {
    label.textContent = isExpanding ? "Collapse all" : "Expand all";
  }
  // DO NOT set toggleAllButton.textContent (it would remove the icons)
}

function collapseAllExpenses() {
  const contents = document.querySelectorAll(
    ".expense-category .category-content",
  );
  const arrows = document.querySelectorAll(".expense-category .category-arrow");
  contents.forEach((content, index) => {
    content.style.maxHeight = "0px";
    if (arrows[index]) arrows[index].style.transform = "rotate(0deg)";
  });
  const label = document.getElementById("toggle-all-expenses-text");
  if (label) label.textContent = "Expand all";
}

function collapseIncomeSection() {
  const content = document.getElementById("income-section-content");
  const arrow = document.getElementById("income-section-arrow");
  const livingExpensesSection = document.getElementById(
    "living-expenses-section",
  );

  if (content) {
    content.style.maxHeight = "0px";
    content.style.opacity = "0";
  }
  if (arrow) {
    arrow.style.transform = "rotate(0deg)";
  }
  if (livingExpensesSection) {
    livingExpensesSection.classList.remove("border-t-0");
  }
}

function expandIncomeSection() {
  const content = document.getElementById("income-section-content");
  const arrow = document.getElementById("income-section-arrow");
  const livingExpensesSection = document.getElementById(
    "living-expenses-section",
  );

  if (content) {
    content.style.maxHeight = "3000px";
    content.style.opacity = "1";
  }
  if (arrow) {
    arrow.style.transform = "rotate(180deg)";
  }
  if (livingExpensesSection) {
    livingExpensesSection.classList.add("border-t-0");
  }
}

function toggleIncomeSection() {
  const content = document.getElementById("income-section-content");
  if (!content) return;

  const isCollapsed = content.style.maxHeight === "0px";

  if (isCollapsed) {
    expandIncomeSection();
  } else {
    collapseIncomeSection();
  }
}

function toggleRetirementSection(isShown) {
  const retirementSection = document.getElementById(
    "retirement-percentage-section",
  );
  if (isShown) {
    retirementSection.style.maxHeight = retirementSection.scrollHeight + "px";
    retirementSection.style.opacity = "1";
  } else {
    retirementSection.style.maxHeight = "0";
    retirementSection.style.opacity = "0";
  }
}

function toggleProvinceDropdown() {
  const dropdownList = document.getElementById("customProvinceOptions");
  const isExpanded =
    dropdownList.style.maxHeight && dropdownList.style.maxHeight !== "0px";

  if (isExpanded) {
    dropdownList.style.maxHeight = "0";
    dropdownList.style.opacity = "0";
  } else {
    dropdownList.style.maxHeight = dropdownList.scrollHeight + "px";
    dropdownList.style.opacity = "1";
  }
}

// Initializes the application on DOM load.
/**
 * Calculates the future value of an investment using compound interest.
 * FV = PMT * ((1 + r)^n - 1) / r
 * where:
 * - PMT is the monthly contribution
 * - r is the monthly interest rate (annual rate / 12)
 * - n is the total number of periods (years * 12)
 */
function calculateFutureValue(
  monthlyContribution,
  years,
  annualRate,
  compoundFrequency,
) {
  // Convert annual rate to decimal
  const r = annualRate / 100;

  // Calculate the rate per period
  const ratePerPeriod = r / compoundFrequency;

  // Calculate total number of periods
  const totalPeriods = years * compoundFrequency;

  // Calculate future value using the compound interest formula
  // FV = PMT * ((1 + r)^n - 1) / r
  const futureValue =
    monthlyContribution *
    ((Math.pow(1 + ratePerPeriod, totalPeriods) - 1) / ratePerPeriod);

  // Calculate total contributions
  const totalContributions = monthlyContribution * totalPeriods;

  // Calculate interest earned
  const interestEarned = futureValue - totalContributions;

  return {
    endingBalance: futureValue,
    totalContributions: totalContributions,
    interestEarned: interestEarned,
  };
}

/**
 * Updates the projection chart based on the selected allocation type (savings, investments, or both)
 */
function updateProjectionChart() {
  const { years, compoundFrequency, currentChartType } =
    calculatorState.compoundInterest;

  // Get the chart instance
  const chartElement = document.getElementById("myPieChart2");

  // Check if chart element exists
  if (!chartElement) {
    return;
  }
  let chart = Chart.getChart(chartElement);

  // If no budget calculation has been performed yet, return early
  if (!calculatorState.currentBudget) {
    return;
  }

  const currentBudget = calculatorState.currentBudget;

  // Get the current input values to check if user has entered 0% or empty
  const savingsPercentageInput = document.getElementById("savingsPercentage");
  const investmentsPercentageInput = document.getElementById(
    "investmentsPercentage",
  );

  const savingsInputValue = savingsPercentageInput
    ? savingsPercentageInput.value
    : "";
  const investmentsInputValue = investmentsPercentageInput
    ? investmentsPercentageInput.value
    : "";

  // Determine the monthly contribution and return rate based on the selected chart type
  let monthlyContribution = 0;
  let returnRate = 0;

  if (currentChartType === "savings") {
    // Check if savings input is 0% or empty - if so, show $0.00
    if (savingsInputValue === "0" || savingsInputValue === "") {
      monthlyContribution = 0;
    } else {
      monthlyContribution =
        currentBudget.recommended_allocations.monthly_savings;
    }
    returnRate = 3; // 3% for savings
  } else if (currentChartType === "investments") {
    // Check if investments input is 0% or empty - if so, show $0.00
    if (investmentsInputValue === "0" || investmentsInputValue === "") {
      monthlyContribution = 0;
    } else {
      monthlyContribution =
        currentBudget.recommended_allocations.monthly_investments;
    }
    returnRate = 10; // 10% for investments
  } else if (currentChartType === "both") {
    const savingsAmount =
      savingsInputValue === "0" || savingsInputValue === ""
        ? 0
        : currentBudget.recommended_allocations.monthly_savings;
    const investmentsAmount =
      investmentsInputValue === "0" || investmentsInputValue === ""
        ? 0
        : currentBudget.recommended_allocations.monthly_investments;
    monthlyContribution = savingsAmount + investmentsAmount;
    // Use simple average of 3% and 10%
    returnRate = (3 + 10) / 2; // 6.5%
  }

  // Calculate the future value
  const { endingBalance, totalContributions, interestEarned } =
    calculateFutureValue(
      monthlyContribution,
      years,
      returnRate,
      compoundFrequency,
    );

  // Define color schemes for different chart types
  const colorSchemes = {
    savings: {
      backgroundColor: [
        "rgba(239, 68, 68, 0.8)", // Red for contributions
        "rgba(59, 130, 246, 0.8)", // Blue for interest
        "rgba(251, 191, 36, 0.8)", // Yellow for ending balance
      ],
      borderColor: [
        "rgba(239, 68, 68, 1)",
        "rgba(59, 130, 246, 1)",
        "rgba(251, 191, 36, 1)",
      ],
      borderWidth: 2,
    },
    investments: {
      backgroundColor: [
        "rgba(34, 197, 94, 0.8)", // Green for contributions
        "rgba(168, 85, 247, 0.8)", // Purple for interest
        "rgba(249, 115, 22, 0.8)", // Orange for ending balance
      ],
      borderColor: [
        "rgba(34, 197, 94, 1)",
        "rgba(168, 85, 247, 1)",
        "rgba(249, 115, 22, 1)",
      ],
      borderWidth: 2,
    },
    both: {
      backgroundColor: [
        "rgba(99, 102, 241, 0.8)", // Indigo for contributions
        "rgba(236, 72, 153, 0.8)", // Pink for interest
        "rgba(14, 165, 233, 0.8)", // Sky blue for ending balance
      ],
      borderColor: [
        "rgba(99, 102, 241, 1)",
        "rgba(236, 72, 153, 1)",
        "rgba(14, 165, 233, 1)",
      ],
      borderWidth: 2,
    },
  };

  const currentColors = colorSchemes[currentChartType] || colorSchemes.savings;

  // Update the chart data as percentages of ending balance
  const contributionPercentage = Math.round(
    (totalContributions / endingBalance) * 100,
  );
  const interestPercentage = Math.round((interestEarned / endingBalance) * 100);
  const chartData = [contributionPercentage, interestPercentage];
  const chartLabels = ["Total Contributions", "Interest Earned"];
  const chartTotal = 100; // Total is always 100%

  if (chart) {
    chart.data.datasets[0].data = chartData;
    chart.data.labels = chartLabels;
    chart.data.datasets[0].backgroundColor =
      currentColors.backgroundColor.slice(0, 2);
    chart.data.datasets[0].borderColor = currentColors.borderColor.slice(0, 2);
    chart.data.datasets[0].borderWidth = currentColors.borderWidth;
    chart.update();
  } else {
    // If chart doesn't exist yet, create it
    chart = new Chart(chartElement.getContext("2d"), {
      type: "pie",
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Projection",
            data: chartData,
            backgroundColor: currentColors.backgroundColor.slice(0, 2),
            borderColor: currentColors.borderColor.slice(0, 2),
            borderWidth: currentColors.borderWidth,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.label || "";
                const percentage = context.raw || 0;
                const dollarValue =
                  label === "Total Contributions"
                    ? totalContributions
                    : interestEarned;
                return `${label}\n${formatCurrency(
                  dollarValue,
                )} (${percentage}%)`;
              },
            },
          },
          legend: {
            display: false,
          },
          title: {
            display: false,
          },
          datalabels: {
            color: "white",
            font: {
              weight: "bold",
              size: 12,
            },
            formatter: function (value, context) {
              return value + "%";
            },
          },
        },
        layout: {
          padding: 10,
        },
      },
    });
  }

  // Display a summary of the projection below the chart
  const summaryElement = document.getElementById("projectionSummary");
  if (summaryElement) {
    const contributionType =
      currentChartType === "savings"
        ? "Savings"
        : currentChartType === "investments"
          ? "Investments"
          : "Combined";

    // Create return rate description based on chart type
    let returnRateDescription = "";
    if (currentChartType === "savings") {
      returnRateDescription = `${returnRate}%
        return (savings rate)`;
    } else if (currentChartType === "investments") {
      returnRateDescription = `${returnRate}%
        return (investment rate)`;
    } else if (currentChartType === "both") {
      returnRateDescription = `${returnRate.toFixed(1)}%
        return (average of savings 3% and investments 10%)`;
    }

    summaryElement.innerHTML = `
      <div class="text-white text-sm">
        <p class="font-semibold mb-2 text-center">${contributionType} Projection</p>
        <p class="text-xs text-white/70 mb-2 text-center">${formatCurrency(
          monthlyContribution,
        )}/month for ${years} years at ${returnRateDescription}</p>
        <div class="space-y-1">
          <div class="flex items-center justify-between p-2 rounded bg-white/10 mb-3">
            <span class="text-sm font-bold">Ending Balance</span>
            <span class="font-bold text-lg">${formatCurrency(
              endingBalance,
            )}</span>
          </div>
          <div class="flex items-center justify-between p-1 rounded cursor-pointer hover:bg-white/5 transition-colors" onclick="toggleChartSegment(0)">
            <div class="flex items-center gap-2">
              <div class="w-4 h-3 rounded" style="background-color: ${
                currentColors.backgroundColor[0]
              }"></div>
              <span class="text-sm" id="legend-0">Total Contributions</span>
            </div>
            <span class="font-semibold">${formatCurrency(
              totalContributions,
            )}</span>
          </div>
          <div class="flex items-center justify-between p-1 rounded cursor-pointer hover:bg-white/5 transition-colors" onclick="toggleChartSegment(1)">
            <div class="flex items-center gap-2">
              <div class="w-4 h-3 rounded" style="background-color: ${
                currentColors.backgroundColor[1]
              }"></div>
              <span class="text-sm" id="legend-1">Interest Earned</span>
            </div>
            <span class="font-semibold">${formatCurrency(interestEarned)}</span>
          </div>
        </div>
      </div>
    `;
  }
}

/**
 * Updates the custom projection chart based on the selected allocation type (savings, investments, or both)
 */
// Render one chart + summary + title (stacked view)
function renderCustomProjection(chartType, canvasId, summaryId, titleId) {
  const { years, compoundFrequency } = calculatorState.compoundInterest;
  if (!calculatorState.currentBudget) return;
  const currentBudget = calculatorState.currentBudget;
  const remainder = Math.max(
    0,
    (currentBudget.monthly_disposable_income || 0) -
      (currentBudget.total_monthly_expenses || 0),
  );

  // Get the current input values to check if user has entered 0% or empty
  const savingsPercentageInput = document.getElementById("savingsPercentage");
  const investmentsPercentageInput = document.getElementById(
    "investmentsPercentage",
  );

  const savingsInputValue = savingsPercentageInput
    ? savingsPercentageInput.value
    : "";
  const investmentsInputValue = investmentsPercentageInput
    ? investmentsPercentageInput.value
    : "";

  // Fallback to recommended amounts when custom values are empty
  const rec = currentBudget.recommended_allocations || {
    monthly_savings: 0,
    monthly_investments: 0,
  };
  const cust = currentBudget.custom_allocations || null;

  let monthlyContribution = 0;
  let returnRate = 0;

  if (chartType === "savings") {
    // Check if savings input is 0% or empty - if so, show $0.00
    if (savingsInputValue === "0" || savingsInputValue === "") {
      monthlyContribution = 0;
    } else {
      // Use the actual current percentage value, not the cached allocation
      const currentSavingsPct = parseFloat(savingsInputValue) || 0;
      monthlyContribution = (currentSavingsPct / 100) * remainder;
    }
    returnRate = 3;
  } else if (chartType === "investments") {
    // Check if investments input is 0% or empty - if so, show $0.00
    if (investmentsInputValue === "0" || investmentsInputValue === "") {
      monthlyContribution = 0;
    } else {
      // Use the actual current percentage value, not the cached allocation
      const currentInvestmentsPct = parseFloat(investmentsInputValue) || 0;
      monthlyContribution = (currentInvestmentsPct / 100) * remainder;
    }
    returnRate = 10;
  } else {
    const currentSavingsPct = parseFloat(savingsInputValue) || 0;
    const currentInvestmentsPct = parseFloat(investmentsInputValue) || 0;
    const s = (currentSavingsPct / 100) * remainder;
    const i = (currentInvestmentsPct / 100) * remainder;
    monthlyContribution = s + i;
    const total = s + i;
    returnRate = total > 0 ? (s * 3 + i * 10) / total : 7;
    returnRate = Math.min(7, Math.round(returnRate * 10) / 10);
  }

  const { endingBalance, totalContributions, interestEarned } =
    calculateFutureValue(
      monthlyContribution,
      years,
      returnRate,
      compoundFrequency,
    );

  // Hide the chart container if monthly contribution is 0 and no data is available
  const containerId =
    chartType === "savings"
      ? "customSavingsView"
      : chartType === "investments"
        ? "customInvestmentsView"
        : "customBothView";
  const containerElements = getAllElements(containerId);
  containerElements.forEach((containerElement) => {
    // Only hide if truly no data (both input is 0/empty AND no recommended data)
    const hasData =
      chartType === "savings"
        ? currentBudget.recommended_savings_pct > 0 ||
          (currentBudget.custom_savings_pct &&
            currentBudget.custom_savings_pct > 0)
        : chartType === "investments"
          ? currentBudget.recommended_investments_pct > 0 ||
            (currentBudget.custom_investments_pct &&
              currentBudget.custom_investments_pct > 0)
          : true; // Both chart always shows if either has data

    if (monthlyContribution === 0 && !hasData) {
      containerElement.classList.add("hidden");
    } else {
      containerElement.classList.remove("hidden");
    }
  });
  if (
    monthlyContribution === 0 &&
    Array.from(containerElements).every((el) => el.classList.contains("hidden"))
  )
    return;

  // Avoid divide-by-zero
  const pctContrib =
    endingBalance > 0
      ? Math.round((totalContributions / endingBalance) * 100)
      : 0;
  const pctInterest =
    endingBalance > 0 ? Math.round((interestEarned / endingBalance) * 100) : 0;

  const colors = {
    savings: {
      background: ["#16815A", "#CDEEE2"],
      border: ["#16815A", "#CDEEE2"],
      borderWidth: 2,
    },
    investments: {
      background: ["#164A83", "#BBD4F0"],
      border: ["#164A83", "#BBD4F0"],
      borderWidth: 2,
    },
    both: {
      background: ["#A33047", "#ECC9D0"],
      border: ["#A33047", "#ECC9D0"],
      borderWidth: 2,
    },
  }[chartType];

  const labels =
    chartType === "savings"
      ? ["Total savings", "Interest earned"]
      : chartType === "investments"
        ? ["Total investments", "Interest earned"]
        : ["Total investments and savings", "Interest earned"];

  const chartElements = getAllElements(canvasId);
  if (chartElements.length === 0) return;

  chartElements.forEach((chartElement) => {
    let chart = Chart.getChart(chartElement);

    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = [pctContrib, pctInterest];
      chart.data.datasets[0].backgroundColor = colors.background;
      chart.data.datasets[0].borderColor = colors.border;
      chart.data.datasets[0].borderWidth = colors.borderWidth;
      chart.update();
    } else {
      chart = new Chart(chartElement.getContext("2d"), {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              label: "Custom Projection",
              data: [pctContrib, pctInterest],
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: colors.borderWidth,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            tooltip: {
              callbacks: {
                label: function (context) {
                  const lbl = context.label || "";
                  const percentage = context.raw || 0;
                  const dollarValue = lbl.toLowerCase().includes("interest")
                    ? interestEarned
                    : totalContributions;
                  return `${lbl}\n${formatCurrency(
                    dollarValue,
                  )} (${percentage}%)`;
                },
              },
            },
            legend: { display: false },
            title: { display: false },
            datalabels: {
              color: "white",
              font: { weight: "bold", size: 12 },
              formatter: () => "",
            },
          },
          layout: { padding: 10 },
        },
      });
    }
  });

  const titleElements = getAllElements(titleId);
  titleElements.forEach((titleElement) => {
    const titleText =
      chartType === "savings"
        ? `Savings projection for ${formatCurrency(
            monthlyContribution,
          )}/month for ${years} years at ${returnRate}% return (savings rate)`
        : chartType === "investments"
          ? `Investments Projection for ${formatCurrency(
              monthlyContribution,
            )}/month for ${years} years at ${returnRate}% return (investment rate)`
          : `Investment and savings projection for ${formatCurrency(
              monthlyContribution,
            )}/month for ${years} years at ${returnRate.toFixed(1)}% return`;
    titleElement.textContent = titleText;
  });

  const summaryElements = getAllElements(summaryId);
  summaryElements.forEach((summaryElement) => {
    const leader = `<span class="flex-1 border-t border-dotted border-gray-300 mx-2"></span>`;
    const greenAmt = (val) =>
      `<span class="font-semibold text-transparent" style="background-image: linear-gradient(to right, var(--base-color-brand--brand-green), var(--base-color-system--focus-state)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">${formatCurrency(
        val,
      )}</span>`;

    summaryElement.innerHTML = `
    <div class="space-y-2 text-sm text-gray-700">
      <div class="flex items-center justify-between p-1 rounded cursor-pointer hover:bg-white/5 transition-colors" onclick="toggleCustomChartSegmentFor('${canvasId}', 0)">
        <div class="flex items-center gap-2">
          <div class="w-4 h-3 rounded" style="background-color: ${colors.background[0]}"></div>
          <span class="text-sm" id="custom-legend-0">Total Contributions</span>
        </div>
        ${greenAmt(totalContributions)}
      </div>
      <div class="flex items-center justify-between p-1 rounded cursor-pointer hover:bg-white/5 transition-colors" onclick="toggleCustomChartSegmentFor('${canvasId}', 1)">
        <div class="flex items-center gap-2">
          <div class="w-4 h-3 rounded" style="background-color: ${colors.background[1]}"></div>
          <span class="text-sm" id="custom-legend-1">Interest Earned</span>
        </div>
        ${greenAmt(interestEarned)}
      </div>
      <div class="flex font-thin items-center">
        <span class="font-semibold">Ending balance</span>
        <span class="flex-1 border-t border-dotted border-gray-300 mx-2"></span>
        <span class="">
        ${leader}
        ${greenAmt(endingBalance)}
        </span>
      </div>
    </div>
  `;
  });
}

function initCombinedToggleSync() {
  const toggles = getAllElements("showCombinedToggle");

  const applyCombinedUi = (isCombined) => {
    const showCombinedTexts = getAllElements("showCombinedText");
    showCombinedTexts.forEach((el) => {
      el.textContent = isCombined
        ? "Show total of savings and investments"
        : "Switch to savings & investments projections";
    });

    const chartsContainers = getAllElements("customChartsContainer");
    chartsContainers.forEach((el) => {
      if (isCombined) {
        el.classList.remove("space-y-10");
        el.classList.add("space-y-0");
      } else {
        el.classList.remove("space-y-0");
        el.classList.add("space-y-10");
      }
    });

    const savingsViews = getAllElements("customSavingsView");
    const investmentsViews = getAllElements("customInvestmentsView");
    const bothViews = getAllElements("customBothView");

    savingsViews.forEach((el) => el.classList.toggle("hidden", isCombined));
    investmentsViews.forEach((el) => el.classList.toggle("hidden", isCombined));
    bothViews.forEach((el) => el.classList.toggle("hidden", !isCombined));
  };

  if (toggles.length > 0) {
    applyCombinedUi(toggles[0].checked);
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      // Sync all other toggles
      toggles.forEach((t) => {
        if (t !== e.target) t.checked = isChecked;
      });
      applyCombinedUi(isChecked);
      scheduleChartsUpdate({ force: false });
    });
  });
}

function scheduleChartsUpdate({ force = false } = {}) {
  if (!calculatorState.currentBudget) return;

  const perf = (window.__swPerf = window.__swPerf || Object.create(null));
  perf.scheduled = (perf.scheduled || 0) + 1;

  const state = (window.__swChartUpdateState =
    window.__swChartUpdateState || Object.create(null));
  state.force = !!state.force || !!force;

  if (state.timeoutId) return;

  const delayMs = state.force ? 0 : 120;
  state.timeoutId = setTimeout(() => {
    const doForce = !!state.force;
    state.force = false;
    state.timeoutId = null;

    const start =
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    if (doForce) {
      forceRefreshCharts();
    } else {
      updateAllCustomProjectionCharts();
    }

    const end =
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    perf.ran = (perf.ran || 0) + 1;
    perf.forced = (perf.forced || 0) + (doForce ? 1 : 0);
    perf.lastMs = Math.round((end - start) * 10) / 10;
  }, delayMs);
}

function debouncedChartUpdate() {
  scheduleChartsUpdate({ force: false });
}

function refreshCustomChartsSoon() {
  scheduleChartsUpdate({ force: true });
}

// Force refresh charts by destroying existing ones
function forceRefreshCharts() {
  // Destroy existing charts to prevent caching issues
  const chartIds = [
    "customSavingsPieChart",
    "customInvestmentsPieChart",
    "customBothPieChart",
  ];
  chartIds.forEach((chartId) => {
    const canvases = getAllElements(chartId);
    canvases.forEach((canvas) => {
      const existingChart = Chart.getChart(canvas);
      if (existingChart) {
        existingChart.destroy();
      }
    });
  });
  // Then update with fresh data
  updateAllCustomProjectionCharts({ bypassSignature: true });
}

// Handle expense changes that affect percentages and amounts
function handleExpenseChangeWithChartSync() {
  // Store previous percentages before recalculation
  const prevSavingsPct = savingsPercentageInput.value;
  const prevInvestmentsPct = investmentsPercentageInput.value;

  // Let the normal calculation happen
  handleExpenseOrAllocationChange();

  // After calculation, check if percentages changed to 0
  setTimeout(() => {
    const budget = calculatorState.currentBudget;
    if (!budget) return;

    // Check if percentages dropped to 0 and amounts need sync
    const currentSavingsPct = savingsPercentageInput.value;
    const currentInvestmentsPct = investmentsPercentageInput.value;

    // Force sync if percentages changed to 0
    if (
      (prevSavingsPct !== "0" && currentSavingsPct === "0") ||
      (prevInvestmentsPct !== "0" && currentInvestmentsPct === "0")
    ) {
      // Force amount fields to 0.00
      if (
        currentSavingsPct === "0" &&
        !customSavingsAmountInput.matches(":focus")
      ) {
        customSavingsAmountInput.value = (0).toFixed(2);
      }
      if (
        currentInvestmentsPct === "0" &&
        !customInvestmentsAmountInput.matches(":focus")
      ) {
        customInvestmentsAmountInput.value = (0).toFixed(2);
      }

      // Force chart refresh
      refreshCustomChartsSoon();
    }
  }, 400);
}

// Render all stacked charts/summaries and titles
function updateAllCustomProjectionCharts({ bypassSignature = false } = {}) {
  if (!calculatorState.currentBudget) return;

  // Get current budget data
  const budget = calculatorState.currentBudget;

  // Check if combined view is enabled
  const showCombinedToggles = getAllElements("showCombinedToggle");
  const isCombined =
    showCombinedToggles.length > 0 ? showCombinedToggles[0].checked : false;

  const sigParts = [
    isCombined ? "1" : "0",
    calculatorState.compoundInterest?.years ?? "",
    calculatorState.compoundInterest?.compoundFrequency ?? "",
    budget.monthly_disposable_income ?? "",
    budget.total_monthly_expenses ?? "",
    budget.recommended_savings_pct ?? "",
    budget.recommended_investments_pct ?? "",
    budget.custom_savings_pct ?? "",
    budget.custom_investments_pct ?? "",
    savingsPercentageInput?.value ?? "",
    investmentsPercentageInput?.value ?? "",
    customSavingsAmountInput?.value ?? "",
    customInvestmentsAmountInput?.value ?? "",
  ];
  const sig = sigParts.join("|");
  if (!bypassSignature && window.__swChartsLastSig === sig) return;
  window.__swChartsLastSig = sig;

  // Determine which charts should be shown based on available data
  const sPctLive = parseFloat(savingsPercentageInput?.value ?? "") || 0;
  const iPctLive = parseFloat(investmentsPercentageInput?.value ?? "") || 0;
  const sAmtLive = parseFloat(customSavingsAmountInput?.value ?? "") || 0;
  const iAmtLive = parseFloat(customInvestmentsAmountInput?.value ?? "") || 0;
  const hasLiveCustom =
    !!calculatorState.customSavingsToggleEnabled &&
    (sPctLive > 0 || iPctLive > 0 || sAmtLive > 0 || iAmtLive > 0);
  const hasSavingsData =
    budget.recommended_savings_pct > 0 ||
    (budget.custom_savings_pct && budget.custom_savings_pct > 0) ||
    (hasLiveCustom && (sPctLive > 0 || sAmtLive > 0));
  const hasInvestmentsData =
    budget.recommended_investments_pct > 0 ||
    (budget.custom_investments_pct && budget.custom_investments_pct > 0) ||
    (hasLiveCustom && (iPctLive > 0 || iAmtLive > 0));

  // Show/hide chart containers based on data availability
  const savingsViews = getAllElements("customSavingsView");
  const investmentsViews = getAllElements("customInvestmentsView");
  const bothViews = getAllElements("customBothView");

  savingsViews.forEach((el) => {
    const shouldHide = isCombined || !hasSavingsData;
    el.classList.toggle("hidden", shouldHide);
  });
  investmentsViews.forEach((el) => {
    const shouldHide = isCombined || !hasInvestmentsData;
    el.classList.toggle("hidden", shouldHide);
  });
  bothViews.forEach((el) => {
    const shouldHide = !isCombined || (!hasSavingsData && !hasInvestmentsData);
    el.classList.toggle("hidden", shouldHide);
  });

  if (isCombined) {
    // Show combined view - only render "both" chart if there's data
    if (hasSavingsData || hasInvestmentsData) {
      renderCustomProjection(
        "both",
        "customBothPieChart",
        "customBothProjectionSummary",
        "customBothTitle",
      );
    }
  } else {
    // Show individual views - render only charts with available data
    if (hasSavingsData) {
      renderCustomProjection(
        "savings",
        "customSavingsPieChart",
        "customSavingsProjectionSummary",
        "customSavingsTitle",
      );
    }
    if (hasInvestmentsData) {
      renderCustomProjection(
        "investments",
        "customInvestmentsPieChart",
        "customInvestmentsProjectionSummary",
        "customInvestmentsTitle",
      );
    }
  }

  // Show mobile save-invest content (find the one NOT in desktop sidebar)
  if (hasSavingsData || hasInvestmentsData) {
    const allSaveContents = getAllElements("save-invest-content");
    allSaveContents.forEach((el) => {
      if (!el.closest("#deductions-disposable-section")) {
        el.classList.remove("hidden");
      }
    });
  }
}

// Backward compatibility for existing calls
function updateCustomProjectionChart() {
  updateAllCustomProjectionCharts();
}

// Toggle a segment for a specific chart
function toggleCustomChartSegmentFor(chartId, segmentIndex) {
  const chartElements = getAllElements(chartId);
  chartElements.forEach((chartElement) => {
    const chart = Chart.getChart(chartElement);
    if (chart && chart.data.datasets[0]) {
      const meta = chart.getDatasetMeta(0);
      if (meta.data[segmentIndex]) {
        meta.data[segmentIndex].hidden = !meta.data[segmentIndex].hidden;
        chart.update();
      }
    }
  });
}

// Function to toggle chart segment visibility (for interactive legends)
function toggleChartSegment(segmentIndex) {
  const chartElement = document.getElementById("myPieChart2");
  const chart = Chart.getChart(chartElement);

  if (chart && chart.data.datasets[0]) {
    const meta = chart.getDatasetMeta(0);
    if (meta.data[segmentIndex]) {
      meta.data[segmentIndex].hidden = !meta.data[segmentIndex].hidden;

      // Toggle strikethrough on legend text
      const legendElement = document.getElementById(`legend-${segmentIndex}`);
      if (legendElement) {
        if (meta.data[segmentIndex].hidden) {
          legendElement.style.textDecoration = "line-through";
          legendElement.style.opacity = "0.5";
        } else {
          legendElement.style.textDecoration = "none";
          legendElement.style.opacity = "1";
        }
      }

      chart.update();
    }
  }
}

// Function to toggle custom chart segment visibility
function toggleCustomChartSegment(segmentIndex) {
  const chartElement = document.getElementById("customPieChart");
  const chart = Chart.getChart(chartElement);

  if (chart && chart.data.datasets[0]) {
    const meta = chart.getDatasetMeta(0);
    if (meta.data[segmentIndex]) {
      meta.data[segmentIndex].hidden = !meta.data[segmentIndex].hidden;

      // Toggle strikethrough on legend text
      const legendElement = document.getElementById(
        `custom-legend-${segmentIndex}`,
      );
      if (legendElement) {
        if (meta.data[segmentIndex].hidden) {
          legendElement.style.textDecoration = "line-through";
          legendElement.style.opacity = "0.5";
        } else {
          legendElement.style.textDecoration = "none";
          legendElement.style.opacity = "1";
        }
      }

      chart.update();
    }
  }
}

function hideMobileResultsInitially() {
  const ids = ["taxes-content", "expenses-content", "save-invest-content"];
  ids.forEach((id) => {
    const els = getAllElements(id);
    els.forEach((el) => {
      // If it is NOT inside the desktop sidebar, it is mobile. Hide it.
      if (!el.closest("#deductions-disposable-section")) {
        el.classList.add("hidden");
      }
    });
  });
}

function initializeApp() {
  hideMobileResultsInitially();
  initializeProvinceDropdown();
  setupEventListeners();
}

/**
 * Handles changes from custom amount inputs. Updates percentages and triggers budget recalculation.
 */
function handleCustomAmountChange(event) {
  if (calculatorState.monthlyDisposableIncome <= 0) return;

  // Get the current input field and its value
  const input = event.target;

  const value = parseFloat(input.value) || 0;

  const mdi =
    calculatorState.currentBudget?.monthly_disposable_income ||
    calculatorState.monthlyDisposableIncome ||
    0;
  const expenses =
    calculatorState.currentBudget?.total_monthly_expenses ||
    calculatorState.totalMonthlyExpensesEntered ||
    0;
  const remainder = Math.max(0, mdi - expenses);

  // Calculate the percentage based on the amount
  const percentage = remainder > 0 ? (value / remainder) * 100 : 0;

  // Update the corresponding percentage input
  if (input.id === "customSavingsAmount") {
    savingsPercentageInput.value = percentage.toFixed(1);
  } else if (input.id === "customInvestmentsAmount") {
    investmentsPercentageInput.value = percentage.toFixed(1);
  }

  // Keep raw numeric value during typing; no currency formatting here

  // Trigger budget recalculation
  handleExpenseOrAllocationChange();
}

// Add new function to update progress bar
function updateProgressBar(expensesPercentage) {
  const progressIndicator = document.getElementById("progressIndicator");
  const indicatorValue = document.getElementById("indicatorValue");

  if (!progressIndicator || !indicatorValue) return;

  // Calculate position based on percentage
  let position;

  if (expensesPercentage <= 70) {
    // Green zone: 0-70% maps to 0-70% of the bar
    position = (expensesPercentage / 70) * 70;
  } else if (expensesPercentage <= 85) {
    // Amber zone: 70-85% maps to 70-85% of the bar
    position = 70 + ((expensesPercentage - 70) / 15) * 15;
  } else {
    // Red zone: 85%+ maps to 85-100% of the bar
    position = 85 + Math.min((expensesPercentage - 85) / 15, 1) * 15;
  }

  // Ensure position doesn't exceed 100%
  position = Math.min(position, 100);

  // Update indicator position and value
  progressIndicator.style.left = `${position}%`;
  indicatorValue.textContent = `${expensesPercentage.toFixed(1)}%`;

  // Add dynamic color to indicator based on zone
  const indicatorDot = progressIndicator.querySelector(".indicator-dot");
  if (indicatorDot) {
    if (expensesPercentage <= 70) {
      indicatorDot.style.background =
        "linear-gradient(135deg, #10b981, #059669)";
      indicatorDot.style.borderColor = "#047857";
    } else if (expensesPercentage <= 85) {
      indicatorDot.style.background =
        "linear-gradient(135deg, #f59e0b, #d97706)";
      indicatorDot.style.borderColor = "#b45309";
    } else {
      indicatorDot.style.background =
        "linear-gradient(135deg, #ef4444, #dc2626)";
      indicatorDot.style.borderColor = "#b91c1c";
    }
  }
}

function updateExpenseHealthBar(budget) {
  // ... existing code ...
  const hasUserCustomInput = !!(budget && budget.custom_allocations);

  const percentUsed = Math.max(
    0,
    Math.min(100, budget?.expenses_percentage || 0),
  );
  const leftAmount = Math.max(
    0,
    (budget?.monthly_disposable_income || 0) -
      (budget?.total_monthly_expenses || 0),
  );

  // Update only the percentage value for all matching elements
  const usedValueSpans = getAllElements("expenseUsedValue");
  usedValueSpans.forEach(
    (el) => (el.textContent = `${percentUsed.toFixed(0)}%`),
  );

  // Right-side label
  const leftTexts = getAllElements("expenseLeftText");
  leftTexts.forEach((el) => {
    el.textContent = `${formatCurrency(leftAmount)} left of ${formatCurrency(budget?.monthly_disposable_income || 0)}`;
  });

  // Grey overlay covers the unused portion from the right
  const overlays = getAllElements("expenseHealthBar");
  overlays.forEach((el) => {
    const remainder = 100 - percentUsed;
    el.style.width = `${remainder}%`;
  });

  // If no custom input, set the simple cashflow display from current budget
  if (!hasUserCustomInput) {
    const currentCashflowAmount =
      budget?.recommended_allocations?.monthly_cashflow || 0;
    const currentCashflowPct = budget?.recommended_cashflow_pct || 0;

    const cashflowAmtEl = document.getElementById("customCashflowAmount");
    const cashflowPctEl = document.getElementById("customCashflowPercentage");
    if (cashflowAmtEl) {
      cashflowAmtEl.textContent = formatCurrency(currentCashflowAmount);
    }
    if (cashflowPctEl) {
      cashflowPctEl.textContent = `(${currentCashflowPct.toFixed(1)}%)`;
    }
  }
  // ... existing code ...
}

function updateExpenseCategorySummary(budget) {
  const mdi = budget?.monthly_disposable_income || 0;
  const exp = budget?.living_expenses || {};
  const sum = (ids) => ids.reduce((s, id) => s + (parseFloat(exp[id]) || 0), 0);

  const rows = [
    {
      key: "housing",
      ids: [
        "rent-mortgage",
        "electricity",
        "water",
        "gas-heating",
        "home-insurance",
        "housing-others",
      ],
    },
    {
      key: "living",
      ids: [
        "groceries",
        "phone-bills",
        "subscriptions",
        "internet",
        "clothing",
        "living-others",
      ],
    },
    {
      key: "transportation",
      ids: [
        "car-payment",
        "gas-fuel",
        "car-insurance",
        "public-transit",
        "car-maintenance",
        "transport-others",
      ],
    },
    {
      key: "loans",
      ids: [
        "student-loans",
        "credit-cards",
        "personal-loans",
        "life-insurance",
        "line-of-credit",
        "loan-others",
      ],
    },
    {
      key: "children",
      ids: [
        "school-tuition",
        "childcare",
        "school-supplies",
        "kids-activities",
        "education-savings",
        "children-others",
      ],
    },
    {
      key: "miscellaneous",
      ids: [
        "healthcare",
        "entertainment",
        "dining-out",
        "pets",
        "gifts-donations",
        "misc-others",
      ],
    },
  ];

  rows.forEach(({ key, ids }) => {
    const total = sum(ids);
    const pct = mdi > 0 ? (total / mdi) * 100 : 0;

    const pctEls = getAllElements(`summary-${key}-pct`);
    const amtEls = getAllElements(`summary-${key}-amt`);
    pctEls.forEach((el) => (el.textContent = `${pct.toFixed(0)}%`));
    amtEls.forEach((el) => (el.textContent = formatCurrency(total)));
  });

  const totalExpEls = getAllElements("summary-total-expenses");
  totalExpEls.forEach((el) => {
    el.textContent = formatCurrency(budget?.total_monthly_expenses || 0);
  });
}

function initDeductionsNav() {
  const nav = document.getElementById("deductions-nav");
  if (!nav) return;

  const desktopContainer = document.getElementById(
    "deductions-disposable-section",
  );
  if (!desktopContainer) return;

  const tabs = nav.querySelectorAll(".deductions-tab");
  const contents = {
    taxes: desktopContainer.querySelector("#taxes-content"),
    expenses: desktopContainer.querySelector("#expenses-content"),
    save: desktopContainer.querySelector("#save-invest-content"),
  };

  const setActive = (key) => {
    tabs.forEach((btn) => {
      const active = btn.dataset.tab === key;
      btn.classList.toggle("bg-[#dbece6]", active);
      btn.classList.toggle("font-semibold", active);
      btn.classList.remove("font-semibold");
    });
    Object.entries(contents).forEach(([name, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", name !== key);
    });

    // Auto-render charts when switching to save & invest tab
    if (key === "save") {
      // Use a small delay to ensure the tab content is visible before rendering
      setTimeout(() => {
        refreshCustomChartsSoon();
      }, 50);
    }
  };

  tabs.forEach((btn) =>
    btn.addEventListener("click", () => setActive(btn.dataset.tab)),
  );

  // Default active tab
  setActive("taxes");
}

function switchToExpensesTab() {
  const nav = document.getElementById("deductions-nav");
  if (!nav) return;
  const btn = nav.querySelector('.deductions-tab[data-tab="expenses"]');
  if (btn) btn.click();
}

function switchToTaxesTab() {
  const nav = document.getElementById("deductions-nav");
  if (!nav) return;
  const btn = nav.querySelector('.deductions-tab[data-tab="taxes"]');
  if (btn) btn.click();
}

function switchToSaveTab() {
  const nav = document.getElementById("deductions-nav");
  if (!nav) return;
  const btn = nav.querySelector('.deductions-tab[data-tab="save"]');
  if (btn) btn.click();
  if (typeof livingExpensesSection !== "undefined" && livingExpensesSection) {
    const rect = livingExpensesSection.getBoundingClientRect();
    const nearThreshold = window.innerHeight * 0.6;
    if (rect.bottom <= nearThreshold || rect.bottom <= 0) {
      collapseAllExpenses();
    }
  }

  const saveInvestTab = document.getElementById("save-invest-content");
  if (saveInvestTab && !saveInvestTab.classList.contains("hidden")) {
    debouncedChartUpdate();
  }
}

// Start the application once the DOM is fully loaded.
document.addEventListener("DOMContentLoaded", () => {
  initializeApp();
  initDeductionsNav();
  initCombinedToggleSync();

  // Set up visibility observer for save & invest tab to ensure charts render properly
  const saveInvestTabs = getAllElements("save-invest-content");
  saveInvestTabs.forEach((saveInvestTab) => {
    let wasVisible = !saveInvestTab.classList.contains("hidden");
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const isVisible = !saveInvestTab.classList.contains("hidden");
          if (isVisible && !wasVisible) refreshCustomChartsSoon();
          wasVisible = isVisible;
        }
      });
    });

    observer.observe(saveInvestTab, {
      attributes: true,
      attributeFilter: ["class"],
    });
  });

  const printDownloadBtn = document.getElementById("print-download-btn");
  const printDownloadBtnMobile = document.getElementById(
    "print-download-btn-mobile",
  );
  const resultsWrapper = document.getElementById(
    "deductions-disposable-section",
  );
  const taxesContent = document.getElementById("taxes-content");

  updatePrintDownloadButtonState();

  function handlePrint() {
    if (resultsWrapper && resultsWrapper.classList.contains("hidden")) {
      resultsWrapper.classList.remove("hidden");
    }

    const expensesContent = document.getElementById("expenses-content");
    const saveInvestContent = document.getElementById("save-invest-content");

    let activeTabKey = "taxes";
    if (saveInvestContent && !saveInvestContent.classList.contains("hidden")) {
      activeTabKey = "save";
    } else if (
      expensesContent &&
      !expensesContent.classList.contains("hidden")
    ) {
      activeTabKey = "expenses";
    } else if (taxesContent && !taxesContent.classList.contains("hidden")) {
      activeTabKey = "taxes";
    }

    const initialStates = {
      taxes: taxesContent ? !taxesContent.classList.contains("hidden") : false,
      expenses: expensesContent
        ? !expensesContent.classList.contains("hidden")
        : false,
      save: saveInvestContent
        ? !saveInvestContent.classList.contains("hidden")
        : false,
    };

    if (taxesContent)
      taxesContent.classList.toggle("hidden", activeTabKey !== "taxes");
    if (expensesContent)
      expensesContent.classList.toggle("hidden", activeTabKey !== "expenses");
    if (saveInvestContent)
      saveInvestContent.classList.toggle("hidden", activeTabKey !== "save");

    const prevPosition = resultsWrapper ? resultsWrapper.style.position : "";
    const prevTop = resultsWrapper ? resultsWrapper.style.top : "";
    if (resultsWrapper) {
      resultsWrapper.style.position = "static";
      resultsWrapper.style.top = "auto";
    }

    const delay = activeTabKey === "save" ? 400 : 200;
    if (activeTabKey === "save") refreshCustomChartsSoon();
    if (activeTabKey === "expenses") {
      try {
        handleExpenseOrAllocationChange();
      } catch (e) {}
    }

    const restore = () => {
      if (resultsWrapper) {
        resultsWrapper.style.position = prevPosition || "";
        resultsWrapper.style.top = prevTop || "";
      }
      if (taxesContent)
        taxesContent.classList.toggle("hidden", !initialStates.taxes);
      if (expensesContent)
        expensesContent.classList.toggle("hidden", !initialStates.expenses);
      if (saveInvestContent)
        saveInvestContent.classList.toggle("hidden", !initialStates.save);
      window.removeEventListener("afterprint", restore);
    };

    window.addEventListener("beforeprint", () => {
      if (activeTabKey === "save") debouncedChartUpdate();
    });
    window.addEventListener("afterprint", restore);

    setTimeout(() => {
      window.print();
    }, delay);

    setTimeout(restore, delay + 800);
  }

  async function handleDirectDownloadPDF() {
    updatePrintDownloadButtonState();
    if (!isPrintDownloadReady()) {
      showToast(
        "Please enter your annual income and at least one monthly expense before downloading results.",
      );
      return;
    }
    const ok = await generateBudgetReportPdf();
    if (!ok) {
      showToast("Unable to generate the PDF report right now.");
    }
  }

  // Email Collection Logic
  const emailModal = document.getElementById("email-modal");
  const emailModalBackdrop = document.getElementById("email-modal-backdrop");
  const userEmailInput = document.getElementById("user-email-input");
  const emailErrorMsg = document.getElementById("email-error-msg");
  const submitEmailBtn = document.getElementById("submit-email-btn");
  const cancelEmailBtn = document.getElementById("cancel-email-btn");

  // Debug: Check if email elements are found
  console.log("Email modal elements:", {
    emailModal: !!emailModal,
    emailModalBackdrop: !!emailModalBackdrop,
    userEmailInput: !!userEmailInput,
    emailErrorMsg: !!emailErrorMsg,
    submitEmailBtn: !!submitEmailBtn,
    cancelEmailBtn: !!cancelEmailBtn,
  });

  const showEmailModal = () => {
    console.log("Showing email modal");
    if (emailModal) {
      emailModal.classList.remove("hidden");
      if (userEmailInput) {
        userEmailInput.value = ""; // Clear previous input
        userEmailInput.focus();
      }
      console.log("Email modal shown successfully");
    } else {
      console.error("Email modal element not found");
    }
  };

  const hideEmailModal = () => {
    if (emailModal) emailModal.classList.add("hidden");
    if (emailErrorMsg) emailErrorMsg.classList.add("hidden");
  };

  function getFinancialHealthTag() {
    const budget = calculatorState.currentBudget;
    if (!budget || !budget.expenses_percentage) {
      return "Healthy";
    }

    const expensePercentage = budget.expenses_percentage;

    // Determine financial health based on expense percentage thresholds
    if (expensePercentage <= 70) {
      return "Healthy";
    } else if (expensePercentage <= 85) {
      return "Cautious";
    } else {
      return "Critical";
    }
  }

  async function submitToMailchimp(email) {
    const actionUrl =
      "https://stewardwellcapital.us14.list-manage.com/subscribe/post?u=060d01fcccabd39539e51f425&id=f1650c082d&f_id=009a5de1f0";

    try {
      console.log(`Starting Mailchimp submission for: ${email}`);

      // Get the financial health tag
      const financialHealthTag = getFinancialHealthTag();
      console.log(`Assigning financial health tag: ${financialHealthTag}`);

      // Create FormData for the Mailchimp submission
      const formData = new FormData();
      formData.append("EMAIL", email);
      formData.append("FNAME", "Subscriber");
      formData.append("LNAME", "Friend");
      formData.append("CALCULATOR", financialHealthTag);
      formData.append("tags", "7016281");
      formData.append("b_060d01fcccabd39539e51f425_f1650c082d", "");
      formData.append("subscribe", "Subscribe");

      // Use fetch API for more reliable submission
      const response = await fetch(actionUrl, {
        method: "POST",
        body: formData,
        mode: "no-cors", // This is important for cross-origin requests to Mailchimp
      });

      console.log("Mailchimp submission response received");
      console.log(`Response status: ${response.status}`);
      console.log(`Response ok: ${response.ok}`);
      console.log("Mailchimp form submitted successfully");

      // Note: With mode: 'no-cors', we can't read the response, but we know the request was sent
      return true;
    } catch (error) {
      console.error("Error during Mailchimp submission:", error);
      console.log("Continuing with download despite Mailchimp error");
      return false;
    }
  }

  if (printDownloadBtn) {
    printDownloadBtn.addEventListener("click", (evt) => {
      evt.preventDefault();
      updatePrintDownloadButtonState();
      if (!isPrintDownloadReady()) {
        showToast(
          "Please enter your annual income and at least one monthly expense before downloading results.",
        );
        return;
      }
      showEmailModal();
    });
  }

  if (printDownloadBtnMobile) {
    printDownloadBtnMobile.addEventListener("click", (evt) => {
      evt.preventDefault();
      updatePrintDownloadButtonState();
      if (!isPrintDownloadReady()) {
        showToast(
          "Please enter your annual income and at least one monthly expense before downloading results.",
        );
        return;
      }
      showEmailModal();
    });
  }

  if (cancelEmailBtn) {
    cancelEmailBtn.addEventListener("click", hideEmailModal);
  }

  if (emailModalBackdrop) {
    emailModalBackdrop.addEventListener("click", hideEmailModal);
  }

  if (submitEmailBtn) {
    submitEmailBtn.addEventListener("click", async () => {
      console.log("Email submit button clicked");
      if (!userEmailInput) {
        console.error("User email input not found");
        return;
      }

      const email = userEmailInput.value.trim();
      console.log(`Email entered: ${email}`);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        console.log("Invalid email format");
        if (emailErrorMsg) {
          emailErrorMsg.classList.remove("hidden");
          emailErrorMsg.textContent = "Please enter a valid email address.";
        }
        return;
      }

      if (emailErrorMsg) emailErrorMsg.classList.add("hidden");

      // Update UI state
      const originalText = submitEmailBtn.textContent;
      submitEmailBtn.textContent = "Processing...";
      submitEmailBtn.disabled = true;

      try {
        console.log("Starting Mailchimp submission process...");
        // Send to Mailchimp
        const result = await submitToMailchimp(email);
        console.log(`Mailchimp submission completed with result: ${result}`);
      } catch (error) {
        console.error("Error during Mailchimp submission:", error);
      } finally {
        // Always proceed to download regardless of Mailchimp result
        console.log("Proceeding to download PDF...");
        submitEmailBtn.textContent = originalText;
        submitEmailBtn.disabled = false;
        hideEmailModal();
        handleDirectDownloadPDF();
      }
    });
  }
});

async function getStewardWellLogoPngDataUrl() {
  const existing = window.__swLogoPngDataUrl;
  if (typeof existing === "string" && existing.length > 0) return existing;

  const svgUrl = new URL("./images/Logo.svg", window.location.href).toString();
  const res = await fetch(svgUrl, { cache: "force-cache" });
  if (!res.ok) throw new Error("Logo fetch failed");
  const svgText = await res.text();

  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Logo image load failed"));
      i.src = blobUrl;
    });

    const naturalW = img.naturalWidth || img.width || 261;
    const naturalH = img.naturalHeight || img.height || 125;
    const scale = 3;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(naturalW * scale));
    canvas.height = Math.max(1, Math.floor(naturalH * scale));
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const pngDataUrl = canvas.toDataURL("image/png");
    window.__swLogoPngDataUrl = pngDataUrl;
    return pngDataUrl;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function generateBudgetReportPdf() {
  const lib = window.jspdf || {};
  const PDF = lib.jsPDF;
  if (!PDF) return false;
  const budget = calculatorState.currentBudget;
  if (!budget) return false;

  let logoDataUrl = null;
  try {
    logoDataUrl = await getStewardWellLogoPngDataUrl();
  } catch (e) {
    logoDataUrl = null;
  }

  const ts = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const doc = new PDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 48;
  const headerH = 64;
  const topY = headerH + 44;
  const bottomMargin = 72;
  const contentW = pageW - marginX * 2;
  const lineH = 16;
  let y = topY;
  const brandGreen = { r: 23, g: 127, b: 91 };
  const brandBlue = { r: 21, g: 77, b: 128 };

  const drawWatermark = () => {
    if (!logoDataUrl) return;
    const aspect = 261 / 125;
    const w = pageW * 0.72;
    const h = w / aspect;
    const x = (pageW - w) / 2;
    const y0 = (pageH - h) / 2;
    const canOpacity =
      typeof doc.GState === "function" && typeof doc.setGState === "function";
    if (canOpacity) doc.setGState(new doc.GState({ opacity: 0.22 }));
    try {
      doc.addImage(logoDataUrl, "PNG", x, y0, w, h, undefined, "FAST");
    } finally {
      if (canOpacity) doc.setGState(new doc.GState({ opacity: 1 }));
    }
  };

  const drawHeader = () => {
    const steps = 10;
    const stepW = pageW / steps;
    for (let i = 0; i < steps; i++) {
      const t = steps <= 1 ? 0 : i / (steps - 1);
      const r = Math.round(brandGreen.r + (brandBlue.r - brandGreen.r) * t);
      const g = Math.round(brandGreen.g + (brandBlue.g - brandGreen.g) * t);
      const b = Math.round(brandGreen.b + (brandBlue.b - brandGreen.b) * t);
      doc.setFillColor(r, g, b);
      doc.rect(i * stepW, 0, stepW + 1, headerH, "F");
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Steward Well Capital — Budget Report", marginX, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, 58);
    doc.setTextColor(0, 0, 0);
  };

  const ensureSpace = (lines = 1) => {
    if (y + lines * lineH > pageH - bottomMargin) {
      doc.addPage();
      y = topY;
      drawWatermark();
      drawHeader();
    }
  };

  const writeLines = (text, fontSize = 11, fontStyle = "normal") => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text), contentW);
    ensureSpace(lines.length);
    doc.text(lines, marginX, y);
    y += lines.length * lineH;
  };

  const sectionTitle = (text) => {
    ensureSpace(2);
    y += 12;
    doc.setTextColor(brandBlue.r, brandBlue.g, brandBlue.b);
    writeLines(text, 12, "bold");
    doc.setTextColor(0, 0, 0);
    y += 2;
  };

  const writeKeyValue = (
    label,
    value,
    {
      labelColor = { r: 90, g: 90, b: 90 },
      valueColor = { r: 0, g: 0, b: 0 },
      valueStyle = "bold",
      fontSize = 11,
    } = {},
  ) => {
    ensureSpace(1);
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(labelColor.r, labelColor.g, labelColor.b);
    doc.text(String(label), marginX, y);
    doc.setFont("helvetica", valueStyle);
    doc.setTextColor(valueColor.r, valueColor.g, valueColor.b);
    doc.text(String(value), pageW - marginX, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += lineH;
  };

  const writeTableRow = (label, value) => {
    const labelText = String(label);
    const valueText = String(value);
    const fontSize = 11;
    const valueGap = 14;
    const baselineOffset = 12;

    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "bold");
    const valueW =
      typeof doc.getTextWidth === "function" ? doc.getTextWidth(valueText) : 0;
    const labelW = Math.max(120, contentW - valueW - valueGap);

    doc.setFont("helvetica", "normal");
    const labelLines = doc.splitTextToSize(labelText, labelW);
    const rowH = Math.max(22, labelLines.length * lineH);

    ensureSpace(Math.ceil((rowH + 4) / lineH));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(35, 35, 35);
    doc.text(labelLines, marginX, y + baselineOffset);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(valueText, pageW - marginX, y + baselineOffset, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
    y += rowH + 4;
  };

  drawWatermark();
  drawHeader();

  sectionTitle("Income");
  writeKeyValue(
    "Annual take home pay",
    formatCurrency(budget.annual_disposable_income || 0),
  );
  writeKeyValue(
    "Total annual deductions",
    formatCurrency(budget.total_deductions || 0),
  );
  writeKeyValue(
    "Monthly take home pay",
    formatCurrency(budget.monthly_disposable_income || 0),
    { valueColor: brandBlue },
  );

  sectionTitle("Expenses");
  const living = budget.living_expenses || {};
  const sum = (ids) =>
    ids.reduce((acc, id) => acc + (parseFloat(living[id]) || 0), 0);

  const rows = [
    {
      label: "Housing and Utilities",
      ids: [
        "rent-mortgage",
        "electricity",
        "water",
        "gas-heating",
        "home-insurance",
        "housing-others",
      ],
    },
    {
      label: "Everyday Spending",
      ids: [
        "groceries",
        "phone-bills",
        "subscriptions",
        "internet",
        "clothing",
        "living-others",
      ],
    },
    {
      label: "Transportation",
      ids: [
        "car-payment",
        "gas-fuel",
        "car-insurance",
        "public-transit",
        "car-maintenance",
        "transport-others",
      ],
    },
    {
      label: "Loans and Insurance",
      ids: [
        "student-loans",
        "credit-cards",
        "personal-loans",
        "life-insurance",
        "line-of-credit",
        "loan-others",
      ],
    },
    {
      label: "Children and Education",
      ids: [
        "school-tuition",
        "childcare",
        "school-supplies",
        "kids-activities",
        "education-savings",
        "children-others",
      ],
    },
    {
      label: "Miscellaneous Expenses",
      ids: [
        "healthcare",
        "entertainment",
        "dining-out",
        "pets",
        "gifts-donations",
        "misc-others",
      ],
    },
  ];

  let anyExpense = false;
  rows.forEach((r) => {
    const total = sum(r.ids);
    if (total > 0) {
      anyExpense = true;
      writeTableRow(r.label, formatCurrency(total));
    }
  });
  if (!anyExpense) {
    writeLines("No monthly expenses entered.");
  } else {
    y += 8;
    writeKeyValue(
      "Total monthly expenses",
      formatCurrency(budget.total_monthly_expenses || 0),
      { valueColor: brandGreen, fontSize: 12 },
    );
    y += 6;
  }

  const allocation =
    budget.custom_allocations && typeof budget.custom_allocations === "object"
      ? budget.custom_allocations
      : budget.recommended_allocations || null;

  const savingsMonthly = allocation ? allocation.monthly_savings || 0 : 0;
  const investmentsMonthly = allocation
    ? allocation.monthly_investments || 0
    : 0;
  const combinedMonthly = savingsMonthly + investmentsMonthly;

  if (combinedMonthly > 0) {
    sectionTitle("Savings & Investments (5-year stats)");

    const years = 5;
    const freq = 12;

    const addStats = (label, monthly, rate) => {
      if (monthly <= 0) return;
      const { totalContributions, interestEarned, endingBalance } =
        calculateFutureValue(monthly, years, rate, freq);
      const cardH = 86;
      ensureSpace(Math.ceil((cardH + 10) / lineH));
      doc.setDrawColor(brandBlue.r, brandBlue.g, brandBlue.b);
      doc.setLineWidth(1);
      doc.line(marginX, y, marginX, y + cardH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(brandBlue.r, brandBlue.g, brandBlue.b);
      doc.text(label, marginX + 10, y + 18);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Monthly contribution", marginX + 10, y + 36);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(monthly), pageW - marginX - 10, y + 36, {
        align: "right",
      });
      doc.setFont("helvetica", "normal");
      doc.text("Total contributions", marginX + 10, y + 52);
      doc.setFont("helvetica", "bold");
      doc.text(
        formatCurrency(totalContributions),
        pageW - marginX - 10,
        y + 52,
        { align: "right" },
      );
      doc.setFont("helvetica", "normal");
      doc.text("Interest earned", marginX + 10, y + 68);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(interestEarned), pageW - marginX - 10, y + 68, {
        align: "right",
      });
      doc.setFont("helvetica", "normal");
      doc.text("Ending balance", marginX + 10, y + 84);
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(endingBalance), pageW - marginX - 10, y + 84, {
        align: "right",
      });
      doc.setTextColor(0, 0, 0);
      y += cardH + 10;
    };

    addStats("Savings", savingsMonthly, 3);
    addStats("Investments", investmentsMonthly, 10);
    addStats("Savings + Investments (Combined)", combinedMonthly, 6.5);
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Steward Well Capital  •  Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 40,
      { align: "center" },
    );
  }
  doc.setTextColor(0, 0, 0);

  doc.save(`Steward Well Capital - Budget Report - ${ts}.pdf`);
  return true;
}

function saveElementAsPdf(el) {
  const lib = window.jspdf || {};
  const PDF = lib.jsPDF;
  if (!window.html2canvas || !PDF) return Promise.resolve(false);
  const opts = {
    scale: 2,
    useCORS: true,
    logging: false,
    letterRendering: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
  };
  return window
    .html2canvas(el, opts)
    .then((canvas) => {
      const doc = new PDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const imgWpx = canvas.width;
      const imgHpx = canvas.height;
      const pxPerMm = imgWpx / pageW;
      const sliceHpx = Math.floor(pageH * pxPerMm);
      let y = 0;
      let page = 0;
      while (y < imgHpx) {
        const slice = document.createElement("canvas");
        slice.width = imgWpx;
        slice.height = Math.min(sliceHpx, imgHpx - y);
        const ctx = slice.getContext("2d");
        ctx.drawImage(
          canvas,
          0,
          y,
          imgWpx,
          slice.height,
          0,
          0,
          imgWpx,
          slice.height,
        );
        const imgData = slice.toDataURL("image/png", 0.95);
        if (page > 0) doc.addPage();
        doc.addImage(imgData, "PNG", 0, 0, pageW, slice.height / pxPerMm);
        y += sliceHpx;
        page += 1;
      }
      doc.save("Steward Well Capital - Budget Results.pdf");
      return true;
    })
    .catch(() => false);
}
function applyDeductionsVisibility() {
  const expanded = !!calculatorState.deductionsExpanded;
  const containers = getAllElements("deduction-inputs-container");
  containers.forEach((container) => {
    Array.from(container.children).forEach((row) => {
      const t = row.getAttribute("data-row-type");
      if (t === "deduction") {
        row.classList.toggle("hidden", !expanded);
      } else if (t === "summary") {
        row.classList.remove("hidden");
      }
    });
  });

  const buttons = getAllElements("toggle-deductions-btn");
  buttons.forEach((btn) => {
    const label = btn.querySelector("span");
    if (!label) return;
    label.textContent = expanded ? "Collapse deductions" : "Expand deductions";
  });
}
getAllElements("toggle-deductions-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    calculatorState.deductionsExpanded = !calculatorState.deductionsExpanded;
    applyDeductionsVisibility();
  });
});
