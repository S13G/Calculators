/* --------------------------------------------------
   Investment Calculator  –  Calculation, Charts, Conditional Visibility
   -------------------------------------------------- */

document.addEventListener("DOMContentLoaded", function () {
  // ========== DOM References ==========
  const startingInput = document.getElementById("investment-starting-amount");
  const returnRateInput = document.getElementById("investment-return-rate");
  const contributionInput = document.getElementById("investment-contribution");
  const targetInput = document.getElementById("investment-target");

  const yearsDisplay = document.getElementById("yearsDropdownSelected");
  const compoundDisplay = document.getElementById("compoundDropdownSelected");
  const frequencyDisplay = document.getElementById("calculateDropdownSelected");

  const frequencyField = document.getElementById("field-contribute-at");

  const chartPlaceholder = document.getElementById("chart-placeholder");
  const chartContainer = document.getElementById("chart-container");
  const barChartYearsSelector = document.getElementById(
    "bar-chart-years-selector",
  );
  const barChartYearsSelect = document.getElementById("barChartYears");

  // Sidebar result elements
  const invStarting = document.getElementById("inv-starting");
  const invInterest = document.getElementById("inv-interest");
  const invContrib = document.getElementById("inv-contrib");
  const invTotal = document.getElementById("inv-total");
  const invStartingLabel = document.getElementById("inv-starting-label");
  const invInterestLabel = document.getElementById("inv-interest-label");
  const invContribLabel = document.getElementById("inv-contrib-label");

  const summaryText = document.getElementById("yearly-growth-text-disabled");
  const projectionText = document.getElementById("yearly-growth-text");

  // ========== Helpers ==========
  function fmt(val) {
    return (
      "$" +
      val.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function parseYears() {
    const text = yearsDisplay?.textContent?.trim() || "5 Years";
    return parseInt(text) || 5;
  }

  function parseCompoundFrequency() {
    const text = compoundDisplay?.textContent?.trim() || "Annually";
    const map = { Monthly: 12, Quarterly: 4, "Semi-Annually": 2, Annually: 1 };
    return map[text] || 1;
  }

  function parseContributionTiming() {
    const text =
      frequencyDisplay?.textContent?.trim() || "Beginning of each month";
    const map = {
      "Beginning of each month": "beginning",
      "End of each month": "end",
      "Beginning of each year": "year-beginning",
      "End of each year": "year-end",
    };
    return map[text] || "beginning";
  }

  // ========== Conditional Visibility ==========
  function updateFrequencyVisibility() {
    if (!frequencyField) return;
    const frequencyBtn = document.getElementById("calculateDropdownBtn");
    const frequencyOptions = document.getElementById(
      "customCalculationTimeOptions",
    );
    const contrib = parseFloat(contributionInput?.value) || 0;
    if (contrib > 0) {
      frequencyField.classList.remove("opacity-50");
      if (frequencyBtn) frequencyBtn.classList.remove("pointer-events-none");
      if (frequencyOptions)
        frequencyOptions.classList.remove("pointer-events-none");
    } else {
      frequencyField.classList.add("opacity-50");
      if (frequencyBtn) frequencyBtn.classList.add("pointer-events-none");
      if (frequencyOptions)
        frequencyOptions.classList.add("pointer-events-none");
    }
  }

  function hasRequiredFields() {
    const start = parseFloat(startingInput?.value) || 0;
    const years = parseYears();
    const rate = parseFloat(returnRateInput?.value) || 0;
    const compound = parseCompoundFrequency();
    return start > 0 && years > 0 && rate > 0 && compound > 0;
  }

  function updateChartVisibility(show) {
    if (chartPlaceholder) chartPlaceholder.classList.toggle("hidden", show);
    if (chartContainer) chartContainer.classList.toggle("hidden", !show);
  }

  // ========== Core Calculation ==========
  function calculateEndAmountWithCompound(
    startingAmount,
    additionalContribution,
    annualRate,
    years,
    compoundPerYear,
    contributionTiming,
  ) {
    const PV = startingAmount;
    const isMonthlyContrib =
      contributionTiming === "beginning" || contributionTiming === "end";

    // Compound interest on principal
    const r_compound = annualRate / compoundPerYear;
    const n_compound = compoundPerYear * years;
    const fvOfPV = PV * Math.pow(1 + r_compound, n_compound);

    // Contributions
    let fvOfAnnuity = 0;
    let totalContributions = 0;

    if (additionalContribution > 0) {
      let r_contrib, n_contrib, pmt;
      if (isMonthlyContrib) {
        // Effective monthly rate derived from compound frequency
        r_contrib = Math.pow(1 + r_compound, compoundPerYear / 12) - 1;
        n_contrib = 12 * years;
        pmt = additionalContribution; // per-month amount
      } else {
        // Effective annual rate derived from compound frequency
        r_contrib = Math.pow(1 + r_compound, compoundPerYear) - 1;
        n_contrib = years;
        pmt = additionalContribution; // per-year amount
      }

      totalContributions = pmt * n_contrib;

      if (r_contrib > 0) {
        fvOfAnnuity =
          pmt * ((Math.pow(1 + r_contrib, n_contrib) - 1) / r_contrib);
        if (
          contributionTiming === "beginning" ||
          contributionTiming === "year-beginning"
        ) {
          fvOfAnnuity *= 1 + r_contrib;
        }
      } else {
        fvOfAnnuity = totalContributions;
      }
    }

    const endBalance = fvOfPV + fvOfAnnuity;
    const totalInterest = endBalance - PV - totalContributions;

    return {
      endBalance,
      startingAmount: PV,
      totalContributions,
      totalInterest: Math.max(0, totalInterest),
    };
  }

  function getCalculationInputs() {
    const startingAmount = parseFloat(startingInput?.value) || 0;
    const returnRate = (parseFloat(returnRateInput?.value) || 0) / 100;
    const contribution = parseFloat(contributionInput?.value) || 0;
    const years = parseYears();
    const compoundPerYear = parseCompoundFrequency();
    const timing = parseContributionTiming();

    return {
      startingAmount,
      returnRate,
      contribution,
      years,
      compoundPerYear,
      timing,
    };
  }

  // ========== Main Update Function ==========
  window.updateInvestmentCalculation = function () {
    updateFrequencyVisibility();

    const {
      startingAmount,
      returnRate,
      contribution,
      years,
      compoundPerYear,
      timing,
    } = getCalculationInputs();

    if (!hasRequiredFields()) {
      updateChartVisibility(false);
      resetSidebar();
      return;
    }

    const result = calculateEndAmountWithCompound(
      startingAmount,
      contribution,
      returnRate,
      years,
      compoundPerYear,
      timing,
    );

    // Update sidebar
    const total =
      result.startingAmount + result.totalInterest + result.totalContributions;
    const startPct =
      total > 0 ? ((result.startingAmount / total) * 100).toFixed(0) : 0;
    const intPct =
      total > 0 ? ((result.totalInterest / total) * 100).toFixed(0) : 0;
    const contPct =
      total > 0 ? ((result.totalContributions / total) * 100).toFixed(0) : 0;

    if (invStartingLabel)
      invStartingLabel.textContent = `Starting amount (${startPct}%)`;
    if (invInterestLabel)
      invInterestLabel.textContent = `Interest earned (${intPct}%)`;
    if (invContribLabel)
      invContribLabel.textContent = `Total contributions (${contPct}%)`;

    if (invStarting) invStarting.textContent = fmt(result.startingAmount);
    if (invInterest) invInterest.textContent = fmt(result.totalInterest);
    if (invContrib) invContrib.textContent = fmt(result.totalContributions);
    if (invTotal) invTotal.textContent = fmt(result.endBalance);

    // Update summary text
    if (summaryText) {
      summaryText.textContent = `Enter your investment details to see projected results.`;
      if (result.endBalance > 0) {
        const ratePct = (returnRate * 100).toFixed(1).replace(/\.0$/, "");
        const compoundText = compoundDisplay?.textContent?.trim() || "Annually";
        const freqText =
          frequencyDisplay?.textContent?.trim() || "Beginning of each month";
        const isMonthlyFreq = freqText.includes("month");
        const freqLabel = isMonthlyFreq ? "monthly" : "yearly";
        summaryText.innerHTML = `Starting with <strong>${fmt(startingAmount)}</strong>${contribution > 0 ? ` and contributing <strong>${fmt(contribution)}</strong> ${freqLabel}` : ""}, your end balance with an interest rate of <strong>${ratePct}%</strong> compounded <strong>${compoundText.toLowerCase()}</strong> over <strong>${years} year${years !== 1 ? "s" : ""}</strong> is <strong>${fmt(result.endBalance)}</strong>.`;
      }
    }

    // Show chart
    updateChartVisibility(true);

    // Render appropriate chart type
    const toggle = document.getElementById("chart-projection-toggle");
    if (toggle && toggle.checked) {
      renderInvestmentBarChart();
    } else {
      renderInvestmentPieChart();
    }
  };

  function resetSidebar() {
    if (invStarting) invStarting.textContent = "$0.00";
    if (invInterest) invInterest.textContent = "$0.00";
    if (invContrib) invContrib.textContent = "$0.00";
    if (invTotal) invTotal.textContent = "$0.00";
    if (invStartingLabel) invStartingLabel.textContent = "Starting amount";
    if (invInterestLabel) invInterestLabel.textContent = "Interest earned";
    if (invContribLabel) invContribLabel.textContent = "Total contributions";
    if (summaryText)
      summaryText.textContent =
        "Enter your investment details to see projected results.";
  }

  // ========== Chart Rendering ==========
  window.renderInvestmentPieChart = function () {
    const canvas = document.getElementById("investmentChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (typeof Chart !== "undefined" && Chart.getChart) {
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
    }
    if (investmentChartInstance) investmentChartInstance.destroy();

    const {
      startingAmount,
      returnRate,
      contribution,
      years,
      compoundPerYear,
      timing,
    } = getCalculationInputs();
    const result = calculateEndAmountWithCompound(
      startingAmount,
      contribution,
      returnRate,
      years,
      compoundPerYear,
      timing,
    );

    investmentChartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Starting amount", "Interest earned", "Total contributions"],
        datasets: [
          {
            data: [
              result.startingAmount,
              result.totalInterest,
              result.totalContributions,
            ],
            backgroundColor: [
              CHART_COLORS.starting,
              CHART_COLORS.interest,
              CHART_COLORS.contrib,
            ],
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: "easeOutQuart",
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            titleFont: { size: 13 },
            bodyFont: { size: 13 },
            callbacks: {
              label: (ctx) => {
                const label = ctx.label || "";
                const val = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(ctx.parsed);
                return label + ": " + val;
              },
            },
          },
        },
      },
    });

    // Hide years selector for pie chart
    if (barChartYearsSelector) barChartYearsSelector.classList.add("hidden");
  };

  window.renderInvestmentBarChart = function () {
    const canvas = document.getElementById("investmentChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (typeof Chart !== "undefined" && Chart.getChart) {
      const existingChart = Chart.getChart(canvas);
      if (existingChart) existingChart.destroy();
    }
    if (investmentChartInstance) investmentChartInstance.destroy();

    const {
      startingAmount,
      returnRate,
      contribution,
      years,
      compoundPerYear,
      timing,
    } = getCalculationInputs();

    let displayYears = barChartYearsSelect
      ? parseInt(barChartYearsSelect.value) || years
      : years;
    displayYears = Math.min(displayYears, 30);
    const maxBars = Math.min(displayYears, 10);

    // Generate yearly data
    const yearlyData = [];
    for (let y = 1; y <= maxBars; y++) {
      const scaledYear =
        displayYears <= 10 ? y : Math.round((y / maxBars) * displayYears);
      const res = calculateEndAmountWithCompound(
        startingAmount,
        contribution,
        returnRate,
        scaledYear,
        compoundPerYear,
        timing,
      );
      yearlyData.push({ year: scaledYear, ...res });
    }

    investmentChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: yearlyData.map((d) => d.year.toString()),
        datasets: [
          {
            label: "Starting amount",
            data: yearlyData.map((d) => d.startingAmount),
            backgroundColor: CHART_COLORS.starting,
            stack: "s0",
          },
          {
            label: "Interest earned",
            data: yearlyData.map((d) => d.totalInterest),
            backgroundColor: CHART_COLORS.interest,
            stack: "s0",
          },
          {
            label: "Total contributions",
            data: yearlyData.map((d) => d.totalContributions),
            backgroundColor: CHART_COLORS.contrib,
            stack: "s0",
            borderRadius: { topLeft: 4, topRight: 4 },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 800,
          easing: "easeOutQuart",
        },
        scales: {
          x: {
            grid: { display: false },
            title: { display: true, text: "Years", font: { size: 12 } },
            ticks: {
              font: { size: 12 },
            },
          },
          y: {
            border: { display: false },
            grid: { color: "#f3f4f6" },
            ticks: {
              callback: (v) => (v >= 1000 ? "$" + v / 1000 + "k" : "$" + v),
              font: { size: 12 },
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            titleFont: { size: 13 },
            bodyFont: { size: 13 },
            footerFont: { size: 13 },
            callbacks: {
              label: (ctx) => ctx.dataset.label + ": " + fmt(ctx.parsed.y),
              footer: (items) => {
                const total = items.reduce((s, i) => s + i.parsed.y, 0);
                return "Total: " + fmt(total);
              },
            },
          },
        },
      },
    });

    // Show years selector for bar chart
    if (barChartYearsSelector) barChartYearsSelector.classList.remove("hidden");
  };

  // ========== Event Listeners ==========
  [startingInput, returnRateInput, contributionInput, targetInput].forEach(
    (el) => {
      if (el) el.addEventListener("input", updateInvestmentCalculation);
    },
  );

  // Bar chart years dropdown
  if (barChartYearsSelect) {
    barChartYearsSelect.addEventListener("change", () => {
      // Sync projection years → number of years dropdown
      const selectedVal = parseInt(barChartYearsSelect.value) || 5;
      const yearsLabel = selectedVal === 1 ? "1 Year" : selectedVal + " Years";
      if (yearsDisplay) {
        yearsDisplay.textContent = yearsLabel;
        yearsDisplay.style.color = "#111827";
      }

      // Recalculate and re-render
      if (typeof updateInvestmentCalculation === "function")
        updateInvestmentCalculation();
    });
  }

  // Additional contribution is user-input only — no auto-population

  // ========== Scroll & Click Observer – auto-switch sidebar tab ==========
  const investmentSection = document.getElementById("investment-calculator");
  const networthSection = document.getElementById("networth-section");

  if (typeof switchResultTab === "function") {
    // Scroll-based: switch when section enters viewport
    if (investmentSection && networthSection) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              if (entry.target === investmentSection)
                switchResultTab("investment");
              else if (entry.target === networthSection)
                switchResultTab("networth");
            }
          });
        },
        { threshold: 0.2 },
      );

      observer.observe(investmentSection);
      observer.observe(networthSection);
    }

    // Click/focus-based: switch when user interacts with a section
    if (networthSection) {
      networthSection.addEventListener("click", () =>
        switchResultTab("networth"),
      );
      networthSection.addEventListener("focusin", () =>
        switchResultTab("networth"),
      );
    }
    if (investmentSection) {
      investmentSection.addEventListener("click", () =>
        switchResultTab("investment"),
      );
      investmentSection.addEventListener("focusin", () =>
        switchResultTab("investment"),
      );
    }
  }

  // ========== Initial Calculation ==========
  updateInvestmentCalculation();
});
