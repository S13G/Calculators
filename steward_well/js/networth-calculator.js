/* --------------------------------------------------
   Networth Calculator  –  Accordion, Dropdowns, Tooltips, Calculation
   -------------------------------------------------- */

// Resize handler for accordion heights
window.addEventListener("resize", () => {
  document.querySelectorAll(".category-content").forEach((content) => {
    if (content.style.maxHeight && content.style.maxHeight !== "0px") {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
});

// Accordion toggle (called from onclick in HTML)
function toggleCategory(categoryName) {
  const allCategories = document.querySelectorAll(".expense-category");
  let current = null;

  allCategories.forEach((cat) => {
    const btn = cat.querySelector(".category-toggle");
    if (btn && btn.getAttribute("onclick")?.includes(categoryName))
      current = cat;
  });
  if (!current) return;

  const content = current.querySelector(".category-content");
  const arrow = current.querySelector(".category-arrow");
  const wasOpen = content.style.maxHeight && content.style.maxHeight !== "0px";

  // Close all first (accordion)
  allCategories.forEach((cat) => {
    const c = cat.querySelector(".category-content");
    const a = cat.querySelector(".category-arrow");
    if (c) c.style.maxHeight = "0px";
    if (a) a.style.transform = "rotate(0deg)";
  });

  if (!wasOpen) {
    content.style.maxHeight = content.scrollHeight + "px";
    if (arrow) arrow.style.transform = "rotate(180deg)";
  }
}

/* ========== Global Chart Instance (used by investment logic) ========== */
let investmentChartInstance = null;

const CHART_COLORS = {
  starting: "#2563EB",
  interest: "#60A5FA",
  contrib: "#86EFAC",
};

/* ========== Tab Switching (Networth vs Investment) ========== */
function switchResultTab(tabName) {
  const btnNW = document.getElementById("tab-networth");
  const btnInv = document.getElementById("tab-investment");
  const contentNW = document.getElementById("content-networth");
  const contentInv = document.getElementById("content-investment");
  const toggle = document.getElementById("projection-toggle-container");

  const active =
    "flex-1 py-2 text-sm font-medium rounded-lg bg-[#DFECE6] text-gray-900 shadow-sm transition-all duration-200";
  const inactive =
    "flex-1 py-2 text-sm font-medium rounded-lg text-gray-600 transition-all duration-200 hover:text-gray-900";

  if (tabName === "networth") {
    btnNW.className = active;
    btnInv.className = inactive;
    contentNW.classList.remove("hidden");
    contentInv.classList.add("hidden");
    toggle.classList.add("invisible");
  } else {
    btnInv.className = active;
    btnNW.className = inactive;
    contentInv.classList.remove("hidden");
    contentNW.classList.add("hidden");
    toggle.classList.remove("invisible");
    if (investmentChartInstance) investmentChartInstance.resize();
  }
}

/* ========== Chart Toggle (Pie ↔ Bar) ========== */
function toggleChartType(element) {
  const checkbox =
    element || document.getElementById("chart-projection-toggle");
  if (!checkbox) return;

  const isChecked = checkbox.checked;
  const summaryText = document.getElementById("yearly-growth-text-disabled");
  const projectionText = document.getElementById("yearly-growth-text");
  const yearsSelector = document.getElementById("bar-chart-years-selector");

  if (isChecked) {
    if (projectionText) projectionText.classList.remove("hidden");
    if (summaryText) summaryText.classList.add("hidden");
    if (yearsSelector) yearsSelector.classList.remove("hidden");
  } else {
    if (projectionText) projectionText.classList.add("hidden");
    if (summaryText) summaryText.classList.remove("hidden");
    if (yearsSelector) yearsSelector.classList.add("hidden");
  }

  // Delegate to investment calculator's render functions
  setTimeout(() => {
    if (isChecked) {
      if (typeof renderInvestmentBarChart === "function")
        renderInvestmentBarChart();
    } else {
      if (typeof renderInvestmentPieChart === "function")
        renderInvestmentPieChart();
    }
  }, 0);
}

/* ========== DOMContentLoaded – Accordion, Dropdowns, Networth ========== */
document.addEventListener("DOMContentLoaded", () => {
  // ========== 1. ACCORDION (Expand/Collapse) ==========
  const expandAllBtn = document.getElementById("toggle-all-expenses");
  const expandAllText = document.getElementById("toggle-all-expenses-text");
  const categoryToggles = document.querySelectorAll(".category-toggle");
  let isAllExpanded = false;

  categoryToggles.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const content = btn.nextElementSibling;
      const arrow = btn.querySelector(".category-arrow");
      const wasOpen =
        content.style.maxHeight && content.style.maxHeight !== "0px";

      document.querySelectorAll(".category-content").forEach((c) => {
        c.style.maxHeight = "0";
        c.style.opacity = "0";
      });
      document.querySelectorAll(".category-arrow").forEach((a) => {
        a.style.transform = "rotate(0deg)";
      });

      if (!wasOpen) {
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.opacity = "1";
        if (arrow) arrow.style.transform = "rotate(180deg)";
      }
      isAllExpanded = false;
      updateExpandBtn(false);
    });
  });

  if (expandAllBtn) {
    expandAllBtn.addEventListener("click", () => {
      isAllExpanded = !isAllExpanded;
      updateExpandBtn(isAllExpanded);
      categoryToggles.forEach((btn) => {
        const content = btn.nextElementSibling;
        const arrow = btn.querySelector(".category-arrow");
        if (isAllExpanded) {
          content.style.maxHeight = content.scrollHeight + "px";
          content.style.opacity = "1";
          if (arrow) arrow.style.transform = "rotate(180deg)";
        } else {
          content.style.maxHeight = "0";
          content.style.opacity = "0";
          if (arrow) arrow.style.transform = "rotate(0deg)";
        }
      });
    });
  }

  function updateExpandBtn(expanded) {
    if (!expandAllText) return;
    expandAllText.textContent = expanded ? "Collapse all" : "Expand all";
    const chevron = expandAllBtn?.querySelector("span:last-child");
    if (chevron) {
      chevron.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";
      chevron.style.transition = "transform 0.3s ease";
    }
  }

  // ========== 2. INVESTMENT DROPDOWNS ==========

  // Dropdown helpers (defined first so all dropdown code can use them)
  function toggleList(list) {
    if (!list) return;
    if (list.style.maxHeight && list.style.maxHeight !== "0px") closeList(list);
    else {
      list.style.maxHeight = "300px";
      list.style.opacity = "1";
    }
  }
  function closeList(list) {
    if (!list) return;
    list.style.maxHeight = "0";
    list.style.opacity = "0";
  }

  const dropdownData = {
    type: [
      { label: "End amount", enabled: true },
      { label: "Additional contribution", enabled: false },
      { label: "Return rate", enabled: false },
      { label: "Starting amount", enabled: false },
      { label: "Investment length", enabled: false },
    ],
    years: [
      "1 Year",
      "3 Years",
      "5 Years",
      "10 Years",
      "15 Years",
      "20 Years",
      "30 Years",
    ],
    compound: ["Monthly", "Quarterly", "Semi-Annually", "Annually"],
    calcTime: [
      "Beginning of each month",
      "End of each month",
      "Beginning of each year",
      "End of each year",
    ],
  };

  // Build calculator type dropdown separately (has special rendering)
  const typeBtn = document.getElementById("calculatorTypeBtn");
  const typeList = document.getElementById("calculatorTypeOptions");
  const typeDisplay = document.getElementById("calculatorTypeSelected");

  if (typeBtn && typeList && typeDisplay) {
    dropdownData.type.forEach((item) => {
      const li = document.createElement("li");
      li.className =
        "px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-between";
      if (item.enabled) {
        li.classList.add(
          "hover:bg-white/20",
          "cursor-pointer",
          "transition-colors",
          "text-slate-800",
        );
        li.innerHTML = item.label;
        li.addEventListener("click", (e) => {
          e.stopPropagation();
          typeDisplay.textContent = item.label;
          typeDisplay.style.color = "#111827";
          closeList(typeList);
        });
      } else {
        li.classList.add("opacity-40", "cursor-not-allowed", "text-slate-500");
        li.innerHTML =
          item.label +
          ' <span class="ml-auto text-[10px] uppercase font-bold bg-red-100 text-red-500 px-2 py-0.5 rounded">Coming Soon</span>';
      }
      typeList.appendChild(li);
    });

    typeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close other dropdowns
      dropdownConfigs.forEach((c) =>
        closeList(document.getElementById(c.listId)),
      );
      toggleList(typeList);
    });
  }

  const dropdownConfigs = [
    {
      btnId: "yearsDropdownBtn",
      listId: "customYearsOptions",
      displayId: "yearsDropdownSelected",
      data: dropdownData.years,
    },
    {
      btnId: "compoundDropdownBtn",
      listId: "customCompoundOptions",
      displayId: "compoundDropdownSelected",
      data: dropdownData.compound,
    },
    {
      btnId: "calculateDropdownBtn",
      listId: "customCalculationTimeOptions",
      displayId: "calculateDropdownSelected",
      data: dropdownData.calcTime,
    },
  ];

  dropdownConfigs.forEach((config) => {
    const btn = document.getElementById(config.btnId);
    const list = document.getElementById(config.listId);
    const display = document.getElementById(config.displayId);
    if (!btn || !list) return;

    config.data.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      li.className =
        "px-4 py-2 hover:bg-white/20 cursor-pointer rounded-lg transition-colors text-slate-800 font-medium text-sm";
      li.addEventListener("click", (e) => {
        e.stopPropagation();
        display.textContent = item;
        display.style.color = "#111827";
        closeList(list);

        // Sync years dropdown → projection years selector
        if (config.displayId === "yearsDropdownSelected") {
          const barChartYears = document.getElementById("barChartYears");
          if (barChartYears) {
            const yearVal = parseInt(item) || 5;
            barChartYears.value = yearVal;
          }
        }

        // Trigger investment recalculation
        if (typeof updateInvestmentCalculation === "function")
          updateInvestmentCalculation();
      });
      list.appendChild(li);
    });

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (typeList) closeList(typeList);
      dropdownConfigs.forEach((other) => {
        if (other.listId !== config.listId)
          closeList(document.getElementById(other.listId));
      });
      toggleList(list);
    });
  });

  document.addEventListener("click", () => {
    dropdownConfigs.forEach((c) =>
      closeList(document.getElementById(c.listId)),
    );
    if (typeList) closeList(typeList);
  });

  // ========== 3. NETWORTH CALCULATION ==========
  const networthState = {
    assets: {},
    liabilities: {},
    totalAssets: 0,
    totalLiabilities: 0,
    networth: 0,
  };

  const networthCategories = {
    assets: [
      "registered-retirement",
      "tfsa-accounts",
      "non-registered-investments",
      "home-value",
      "other-properties",
      "other-valuables",
    ],
    liabilities: [
      "home-mortgage",
      "other-mortgages",
      "credit-cards",
      "lines-of-credit",
      "loans",
      "other-liabilities",
    ],
  };

  function initNetworth() {
    const section = document.getElementById("networth-section");
    if (section) {
      section.classList.remove("opacity-50", "pointer-events-none");
      section.classList.add("animate-fade-in");
    }
    document
      .querySelectorAll(
        "#networth-section .asset-input, #networth-section .liability-input",
      )
      .forEach((input) => {
        input.addEventListener("input", calculateNetworth);
        input.addEventListener("blur", calculateNetworth);
      });
  }

  function calculateNetworth() {
    networthState.totalAssets = 0;
    networthState.assets = {};
    networthCategories.assets.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        const val = parseFloat(input.value) || 0;
        networthState.assets[id] = val;
        networthState.totalAssets += val;
      }
    });

    networthState.totalLiabilities = 0;
    networthState.liabilities = {};
    networthCategories.liabilities.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        const val = parseFloat(input.value) || 0;
        networthState.liabilities[id] = val;
        networthState.totalLiabilities += val;
      }
    });

    networthState.networth =
      networthState.totalAssets - networthState.totalLiabilities;
    updateNetworthDisplay();
    updateSidebarNetworth();
    updateInvestmentStartingAmount();
  }

  function fmt(amount) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 2,
    }).format(amount);
  }

  function updateNetworthDisplay() {
    const elAssets = document.getElementById("total-assets");
    const elLiabilities = document.getElementById("total-liabilities");
    const elNetworth = document.getElementById("total-networth");
    if (elAssets) elAssets.textContent = fmt(networthState.totalAssets);
    if (elLiabilities)
      elLiabilities.textContent = fmt(networthState.totalLiabilities);
    if (elNetworth) {
      elNetworth.textContent = fmt(networthState.networth);
      elNetworth.className =
        networthState.networth >= 0
          ? "text-2xl font-bold text-green-600"
          : "text-2xl font-bold text-red-600";
    }
    // Category subtotals
    const elAT = document.getElementById("assets-total");
    const elLT = document.getElementById("liabilities-total");
    if (elAT) elAT.textContent = fmt(networthState.totalAssets);
    if (elLT) elLT.textContent = fmt(networthState.totalLiabilities);
  }

  function updateSidebarNetworth() {
    const total = networthState.totalAssets + networthState.totalLiabilities;
    const assetsPct =
      total > 0 ? (networthState.totalAssets / total) * 100 : 50;
    const liabPct =
      total > 0 ? (networthState.totalLiabilities / total) * 100 : 50;

    const barA = document.getElementById("nw-assets-bar");
    const barL = document.getElementById("nw-liabilities-bar");
    if (barA) barA.style.width = Math.max(assetsPct, 2) + "%";
    if (barL) barL.style.width = Math.max(liabPct, 2) + "%";

    const elA = document.getElementById("nw-total-assets");
    const elL = document.getElementById("nw-total-liabilities");
    const elF = document.getElementById("nw-final");
    if (elA) elA.textContent = fmt(networthState.totalAssets);
    if (elL) elL.textContent = fmt(networthState.totalLiabilities);
    if (elF) elF.textContent = fmt(networthState.networth);
  }

  // Auto-populate investment starting amount = RRS + TFSA + NRSI
  function updateInvestmentStartingAmount() {
    const rrs =
      parseFloat(document.getElementById("registered-retirement")?.value) || 0;
    const tfsa =
      parseFloat(document.getElementById("tfsa-accounts")?.value) || 0;
    const nrsi =
      parseFloat(
        document.getElementById("non-registered-investments")?.value,
      ) || 0;
    const sum = rrs + tfsa + nrsi;

    const startInput = document.getElementById("investment-starting-amount");
    if (startInput) {
      startInput.value = sum > 0 ? sum : "";
      startInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  window.calculateNetworth = calculateNetworth;
  initNetworth();

  // ========== 4. TOOLTIPS (unified) ==========
  const tooltipPairs = [
    // Container headings
    ["networthCalcTooltipToggle", "networthCalcTooltip"],
    ["yourAssetsTooltipToggle", "yourAssetsTooltip"],
    ["yourLiabilitiesTooltipToggle", "yourLiabilitiesTooltip"],
    ["growNetworthTooltipToggle", "growNetworthTooltip"],
    // Asset fields
    ["tooltipToggle", "tooltip"],
    ["tfsaTooltipToggle", "tfsaTooltip"],
    ["nonRegisteredTooltipToggle", "nonRegisteredTooltip"],
    ["homeValueTooltipToggle", "homeValueTooltip"],
    ["otherPropertiesTooltipToggle", "otherPropertiesTooltip"],
    ["otherValueableTooltipToggle", "otherValuableTooltip"],
    // Liability fields
    ["homeMortgageTooltipToggle", "homeMortgageTooltip"],
    ["otherMortgagesTooltipToggle", "otherMortgagesTooltip"],
    ["creditCardsTooltipToggle", "creditCardsTooltip"],
    ["linesOfCreditTooltipToggle", "linesOfCreditTooltip"],
    ["loansTooltipToggle", "loansTooltip"],
    ["otherLiabTooltipToggle", "otherLiabTooltip"],
    // Investment fields
    ["startingAmtTooltipToggle", "startingAmtTooltip"],
    ["yearsTooltipToggle", "yearsTooltip"],
    ["returnRateTooltipToggle", "returnRateTooltip"],
    ["compoundTooltipToggle", "compoundTooltip"],
    ["contributionTooltipToggle", "contributionTooltip"],
    ["frequencyTooltipToggle", "frequencyTooltip"],
    ["targetTooltipToggle", "targetTooltip"],
    ["calcTypeTooltipToggle", "calcTypeTooltip"],
  ]
    .map(([tId, ttId]) => ({
      toggle: document.getElementById(tId),
      tooltip: document.getElementById(ttId),
    }))
    .filter(({ toggle, tooltip }) => toggle && tooltip);

  function closeAllTooltips() {
    tooltipPairs.forEach(({ tooltip }) => {
      tooltip.classList.remove("opacity-100", "pointer-events-auto");
      tooltip.classList.add("opacity-0", "pointer-events-none");
    });
  }

  tooltipPairs.forEach(({ toggle, tooltip }) => {
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const visible = tooltip.classList.contains("opacity-100");
      closeAllTooltips();
      if (!visible) {
        tooltip.classList.remove("opacity-0", "pointer-events-none");
        tooltip.classList.add("opacity-100", "pointer-events-auto");
      }
    });
  });

  document.addEventListener("click", (e) => {
    const inside = tooltipPairs.some(
      ({ tooltip, toggle }) =>
        tooltip.contains(e.target) || toggle.contains(e.target),
    );
    if (!inside) closeAllTooltips();
  });
});
