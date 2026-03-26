/* --------------------------------------------------
   PDF Export  –  Networth & Investment Report
   With Mailchimp email collection
   -------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("print-download-btn");

  // Email modal elements
  const emailModal = document.getElementById("email-modal");
  const emailModalBackdrop = document.getElementById("email-modal-backdrop");
  const userEmailInput = document.getElementById("user-email-input");
  const emailErrorMsg = document.getElementById("email-error-msg");
  const submitEmailBtn = document.getElementById("submit-email-btn");
  const cancelEmailBtn = document.getElementById("cancel-email-btn");
  const loadingOverlay = document.getElementById("capture-loading");

  function showEmailModal() {
    if (emailModal) {
      emailModal.classList.remove("hidden");
      if (userEmailInput) {
        userEmailInput.value = "";
        userEmailInput.focus();
      }
    }
  }

  function hideEmailModal() {
    if (emailModal) emailModal.classList.add("hidden");
    if (emailErrorMsg) emailErrorMsg.classList.add("hidden");
  }

  function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove("hidden");
  }

  function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }

  async function submitToMailchimp(email) {
    const actionUrl =
      "https://stewardwellcapital.us14.list-manage.com/subscribe/post?u=060d01fcccabd39539e51f425&id=f1650c082d&f_id=009a5de1f0";

    try {
      const formData = new FormData();
      formData.append("EMAIL", email);
      formData.append("FNAME", "Subscriber");
      formData.append("LNAME", "Friend");
      formData.append("CALCULATOR", "Networth");
      formData.append("tags", "7016281");
      formData.append("b_060d01fcccabd39539e51f425_f1650c082d", "");
      formData.append("subscribe", "Subscribe");

      await fetch(actionUrl, {
        method: "POST",
        body: formData,
        mode: "no-cors",
      });
      return true;
    } catch (error) {
      console.error("Mailchimp submission error:", error);
      return false;
    }
  }

  // Print button → show email modal
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showEmailModal();
    });
  }

  // Cancel / backdrop → hide modal
  if (cancelEmailBtn) cancelEmailBtn.addEventListener("click", hideEmailModal);
  if (emailModalBackdrop)
    emailModalBackdrop.addEventListener("click", hideEmailModal);

  // Submit email → Mailchimp → PDF download
  if (submitEmailBtn) {
    submitEmailBtn.addEventListener("click", async () => {
      if (!userEmailInput) return;

      const email = userEmailInput.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        if (emailErrorMsg) {
          emailErrorMsg.classList.remove("hidden");
          emailErrorMsg.textContent = "Please enter a valid email address.";
        }
        return;
      }

      if (emailErrorMsg) emailErrorMsg.classList.add("hidden");

      const originalText = submitEmailBtn.textContent;
      submitEmailBtn.textContent = "Processing...";
      submitEmailBtn.disabled = true;

      try {
        await submitToMailchimp(email);
      } catch (error) {
        console.error("Mailchimp error:", error);
      } finally {
        submitEmailBtn.textContent = originalText;
        submitEmailBtn.disabled = false;
        hideEmailModal();
        showLoading();
        try {
          await generateNetworthReport();
        } catch (error) {
          console.error("PDF generation error:", error);
          alert(
            "We could not generate your PDF right now. Please try again in a moment.",
          );
        } finally {
          hideLoading();
        }
      }
    });
  }
});

async function generateNetworthReport() {
  const lib = window.jspdf || {};
  const PDF = lib.jsPDF;
  if (!PDF) {
    alert("PDF library not loaded.");
    return;
  }

  const doc = new PDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const marginX = 48;
  const headerH = 64;
  const topY = headerH + 36;
  const bottomMargin = 60;
  const lineH = 18;
  let y = topY;
  const green = { r: 23, g: 127, b: 91 };
  const blue = { r: 21, g: 77, b: 128 };

  function drawHeader(title) {
    const steps = 10;
    const stepW = pageW / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      doc.setFillColor(
        Math.round(green.r + (blue.r - green.r) * t),
        Math.round(green.g + (blue.g - green.g) * t),
        Math.round(green.b + (blue.b - green.b) * t),
      );
      doc.rect(i * stepW, 0, stepW + 1, headerH, "F");
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Steward Well Capital — " + title, marginX, 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Generated: " + new Date().toLocaleString(), marginX, 54);
    doc.setTextColor(0, 0, 0);
  }

  function ensureSpace(lines) {
    if (y + lines * lineH > pageH - bottomMargin) {
      doc.addPage();
      y = topY;
    }
  }

  function sectionTitle(text) {
    ensureSpace(3);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(green.r, green.g, green.b);
    doc.text(text, marginX, y);
    y += 6;
    doc.setDrawColor(green.r, green.g, green.b);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, pageW - marginX, y);
    y += lineH;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
  }

  function row(label, value, bold) {
    ensureSpace(1);
    if (bold) doc.setFont("helvetica", "bold");
    doc.text(label, marginX + 8, y);
    doc.text(value, pageW - marginX - 8, y, { align: "right" });
    if (bold) doc.setFont("helvetica", "normal");
    y += lineH;
  }

  function fmt(v) {
    return (
      "$" +
      (parseFloat(v) || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  function getVal(id) {
    return parseFloat(document.getElementById(id)?.value) || 0;
  }
  function getText(id) {
    return document.getElementById(id)?.textContent?.trim() || "";
  }

  async function renderChartImage(config, width = 1100, height = 620) {
    if (typeof Chart === "undefined") return null;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return null;

    config = JSON.parse(JSON.stringify(config));
    if (!config.options) config.options = {};
    config.options.responsive = false;
    config.options.animation = false;

    const chart = new Chart(tempCtx, config);
    await new Promise((r) => setTimeout(r, 50));
    const imgData = tempCanvas.toDataURL("image/png");
    chart.destroy();
    return imgData;
  }

  // ========== Page 1: Networth Summary ==========
  drawHeader("Networth & Investment Report");

  sectionTitle("Assets");
  const assetItems = [
    ["Registered Retirement Savings", getVal("registered-retirement")],
    ["TFSA Accounts", getVal("tfsa-accounts")],
    ["Non-Registered Investments", getVal("non-registered-investments")],
    ["Home Value", getVal("home-value")],
    ["Other Properties", getVal("other-properties")],
    ["Other Valuables", getVal("other-valuables")],
  ];
  let totalAssets = 0;
  assetItems.forEach(([label, val]) => {
    totalAssets += val;
    row(label, fmt(val));
  });
  y += 4;
  row("Total Assets", fmt(totalAssets), true);
  y += 10;

  sectionTitle("Liabilities");
  const liabItems = [
    ["Home Mortgage", getVal("home-mortgage")],
    ["Other Mortgages", getVal("other-mortgages")],
    ["Credit Cards", getVal("credit-cards")],
    ["Lines of Credit", getVal("lines-of-credit")],
    ["Loans", getVal("loans")],
    ["Other Liabilities", getVal("other-liabilities")],
  ];
  let totalLiab = 0;
  liabItems.forEach(([label, val]) => {
    totalLiab += val;
    row(label, fmt(val));
  });
  y += 4;
  row("Total Liabilities", fmt(totalLiab), true);
  y += 10;

  // Networth
  ensureSpace(2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const nw = totalAssets - totalLiab;
  doc.setTextColor(
    nw >= 0 ? green.r : 200,
    nw >= 0 ? green.g : 0,
    nw >= 0 ? green.b : 0,
  );
  doc.text("Net Worth: " + fmt(nw), marginX, y);
  doc.setTextColor(0, 0, 0);
  y += lineH * 2;

  // ========== Investment Projection ==========
  const startAmt = getVal("investment-starting-amount");
  const returnRate = getVal("investment-return-rate");
  const contribution = getVal("investment-contribution");
  const yearsText = getText("yearsDropdownSelected");
  const compoundText = getText("compoundDropdownSelected");
  const freqText = getText("calculateDropdownSelected");
  const yearsNum = parseInt(yearsText) || 5;

  sectionTitle(yearsNum + "-Year Investment Projection");

  row("Starting Amount", fmt(startAmt));
  row("Rate of Return", returnRate + "%");
  row("Additional Contribution", fmt(contribution));
  row("Investment Period", yearsText);
  row("Compound", compoundText);
  row("Frequency", freqText);
  y += 8;

  // Results from sidebar
  row("Starting Amount", getText("inv-starting"), false);
  row("Interest Earned", getText("inv-interest"), false);
  row("Total Contributions", getText("inv-contrib"), false);
  y += 4;
  row("Ending Balance", getText("inv-total"), true);

  // ========== Render both charts for PDF ==========
  // --- Pie Chart with percentages & amounts ---
  if (typeof Chart !== "undefined") {
    // Build an offscreen pie chart with percentage + amount labels

    const startVal =
      parseFloat(getText("inv-starting").replace(/[^0-9.-]/g, "")) || 0;
    const interestVal =
      parseFloat(getText("inv-interest").replace(/[^0-9.-]/g, "")) || 0;
    const contribVal =
      parseFloat(getText("inv-contrib").replace(/[^0-9.-]/g, "")) || 0;
    const totalVal = startVal + interestVal + contribVal;
    const startPct =
      totalVal > 0 ? ((startVal / totalVal) * 100).toFixed(1) : 0;
    const intPct =
      totalVal > 0 ? ((interestVal / totalVal) * 100).toFixed(1) : 0;
    const contPct =
      totalVal > 0 ? ((contribVal / totalVal) * 100).toFixed(1) : 0;

    const CHART_COLORS = {
      starting: "#2563EB",
      interest: "#60A5FA",
      contrib: "#86EFAC",
    };

    const pieChartConfig = {
      type: "pie",
      data: {
        labels: [
          "Starting amount (" + startPct + "%) — " + fmt(startVal),
          "Interest earned (" + intPct + "%) — " + fmt(interestVal),
          "Total contributions (" + contPct + "%) — " + fmt(contribVal),
        ],
        datasets: [
          {
            data: [startVal, interestVal, contribVal],
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
        animation: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              font: { size: 14 },
              padding: 12,
              usePointStyle: true,
            },
          },
          tooltip: { enabled: false },
        },
      },
    };

    const pieImgData = await renderChartImage(pieChartConfig);

    try {
      if (pieImgData) {
        ensureSpace(18);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(green.r, green.g, green.b);
        doc.text("Investment Breakdown", marginX, y);
        y += lineH;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const chartW = pageW - marginX * 2;
        const chartH = chartW * 0.55;
        doc.addImage(pieImgData, "PNG", marginX, y, chartW, chartH);
        y += chartH + 16;
      }
    } catch (e) {
      // canvas tainted or not available
    }
  }

  // --- Bar Chart with x/y axes ---
  if (typeof Chart !== "undefined") {
    // Check if we need a new page
    if (y + 250 > pageH - bottomMargin) {
      doc.addPage();
      drawHeader("Networth & Investment Report");
      y = topY;
    }

    const CHART_COLORS = {
      starting: "#2563EB",
      interest: "#60A5FA",
      contrib: "#86EFAC",
    };

    // Build bar chart data
    const annualRate = (parseFloat(returnRate) || 0) / 100;
    const compoundMap = {
      Monthly: 12,
      Quarterly: 4,
      "Semi-Annually": 2,
      Annually: 1,
    };
    const compoundPerYear = compoundMap[compoundText] || 1;
    const timingMap = {
      "Beginning of each month": "beginning",
      "End of each month": "end",
      "Beginning of each year": "year-beginning",
      "End of each year": "year-end",
    };
    const timing = timingMap[freqText] || "beginning";

    const displayYears = Math.min(yearsNum, 30);
    const maxBars = Math.min(displayYears, 10);

    function calcCompound(pv, contrib, rate, yrs, cpd, timingVal) {
      const rComp = rate / cpd;
      const nComp = cpd * yrs;
      const fvPV = pv * Math.pow(1 + rComp, nComp);
      let fvAnnuity = 0;
      let totalContrib = 0;
      if (contrib > 0) {
        const isMonthly = timingVal === "beginning" || timingVal === "end";
        let rC, nC, pmt;
        if (isMonthly) {
          rC = Math.pow(1 + rComp, cpd / 12) - 1;
          nC = 12 * yrs;
          pmt = contrib;
        } else {
          rC = Math.pow(1 + rComp, cpd) - 1;
          nC = yrs;
          pmt = contrib;
        }
        totalContrib = pmt * nC;
        if (rC > 0) {
          fvAnnuity = pmt * ((Math.pow(1 + rC, nC) - 1) / rC);
          if (timingVal === "beginning" || timingVal === "year-beginning")
            fvAnnuity *= 1 + rC;
        } else {
          fvAnnuity = totalContrib;
        }
      }
      const end = fvPV + fvAnnuity;
      return {
        startingAmount: pv,
        totalContributions: totalContrib,
        totalInterest: Math.max(0, end - pv - totalContrib),
        endBalance: end,
      };
    }

    const yearlyData = [];
    for (let i = 1; i <= maxBars; i++) {
      const scaledYear =
        displayYears <= 10 ? i : Math.round((i / maxBars) * displayYears);
      const res = calcCompound(
        startAmt,
        contribution,
        annualRate,
        scaledYear,
        compoundPerYear,
        timing,
      );
      yearlyData.push({ year: scaledYear, ...res });
    }

    const barChartConfig = {
      type: "bar",
      data: {
        labels: yearlyData.map((d) => "Year " + d.year),
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
        animation: false,
        scales: {
          x: {
            grid: { display: false },
            title: {
              display: true,
              text: "Years",
              font: { size: 13, weight: "bold" },
            },
            ticks: {
              font: { size: 12 },
            },
          },
          y: {
            border: { display: true },
            grid: { color: "#e5e7eb" },
            title: {
              display: true,
              text: "Balance ($)",
              font: { size: 13, weight: "bold" },
            },
            ticks: {
              callback: (v) =>
                v >= 1000 ? "$" + (v / 1000).toFixed(0) + "k" : "$" + v,
              font: { size: 12 },
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { font: { size: 12 }, padding: 10, usePointStyle: true },
          },
          tooltip: { enabled: false },
        },
      },
    };

    const barImgData = await renderChartImage(barChartConfig);

    try {
      if (barImgData) {
        ensureSpace(18);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(green.r, green.g, green.b);
        doc.text("Yearly Growth Projection", marginX, y);
        y += lineH;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        const chartW = pageW - marginX * 2;
        const chartH = chartW * 0.55;
        doc.addImage(barImgData, "PNG", marginX, y, chartW, chartH);
        y += chartH + 16;
      }
    } catch (e) {
      // canvas tainted or not available
    }
  }

  // ========== Footer ==========
  ensureSpace(2);
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This report is for informational purposes only and does not constitute financial advice.",
    marginX,
    pageH - 30,
  );
  doc.text(
    "© " + new Date().getFullYear() + " Steward Well Capital",
    marginX,
    pageH - 18,
  );

  // Save
  const ts = new Date().toISOString().slice(0, 10);
  doc.save("StewardWell-Report-" + ts + ".pdf");
}
