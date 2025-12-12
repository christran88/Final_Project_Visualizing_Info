// ---- SVG / layout setup ----
const svg = d3.select("#chart");
const margin = { top: 50, right: 40, bottom: 50, left: 80 };
const width = +svg.attr("width") - margin.left - margin.right;
const height = +svg.attr("height") - margin.top - margin.bottom;

const chartG = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const defs = svg.append("defs");
defs.append("clipPath")
  .attr("id", "plot-clip")
  .append("rect")
  .attr("width", width)
  .attr("height", height);

const plotArea = chartG.append("g")
  .attr("class", "plot-area")
  .attr("clip-path", "url(#plot-clip)");

const xScale = d3.scaleTime().range([0, width]);
const yScale = d3.scaleLinear().range([height, 0]);

const xAxisG = chartG.append("g")
  .attr("class", "axis x-axis")
  .attr("transform", `translate(0,${height})`);

const yAxisG = chartG.append("g")
  .attr("class", "axis y-axis");

chartG.append("text")
  .attr("text-anchor", "middle")
  .attr("x", width / 2)
  .attr("y", height + 40)
  .style("font-size", "0.8rem")
  .text("Time");

const yLabel = chartG.append("text")
  .attr("text-anchor", "middle")
  .attr("transform", "rotate(-90)")
  .attr("x", -height / 2)
  .attr("y", -60)
  .style("font-size", "0.8rem")
  .text("Number of enrollees");

const tooltip = d3.select("#tooltip");

// transparent overlay for mouse interaction
const overlay = plotArea.append("rect")
  .attr("width", width)
  .attr("height", height)
  .style("fill", "none")
  .style("pointer-events", "all");

const dateFmt = d3.timeFormat("%Y-%m");
const numFmt = d3.format(",.0f");
const pctFmt = d3.format(".1f");
const bisectDate = d3.bisector(d => d.date).left;

const stateSelect = d3.select("#state-select");
const modeInputs = d3.selectAll("input[name='mode']");
const chartTitle = d3.select("#chart-title");

const zoomInBtn = d3.select("#zoom-in");
const zoomOutBtn = d3.select("#zoom-out");
const zoomResetBtn = d3.select("#zoom-reset");

// legend configuration
const legendConfigCounts = [
  { id: "total",  label: "Total Medicaid enrollees", color: "#1f77b4" },
  { id: "viii",   label: "VIII group enrollees",     color: "#ff7f0e" },
  { id: "newly",  label: "Newly eligible VIII enrollees", color: "#2ca02c" }
];

const legendConfigShare = [
  { id: "share_viii",  label: "VIII group \u00f7 Total Medicaid",         color: "#ff7f0e" },
  { id: "share_newly", label: "Newly eligible VIII \u00f7 Total Medicaid", color: "#2ca02c" }
];

// state and shared variables
let rawData = [];
let currentState = null;
let currentMode = "counts";
let currentSeriesData = [];
let fullDomain = null;

let focusedCountsId = null;
let focusedShareId  = null;

// legend group
const legendG = initLegend(chartG);

const noDataText = chartG.append("text")
  .attr("class", "no-data")
  .attr("x", width / 2)
  .attr("y", height / 2)
  .attr("text-anchor", "middle")
  .style("display", "none")
  .text("No data for this state.");

const lineGenerator = d3.line()
  .defined(d => d.value != null && !isNaN(d.value))
  .x(d => xScale(d.date))
  .y(d => yScale(d.value));

const lineGroup = plotArea.append("g");

// drag for panning
let isDragging = false;
let dragStartX = null;
let dragStartXDomain = null;

// ---- axis drawing helper ----
function drawXAxis() {
  const domain = xScale.domain();
  const spanMs = domain[1] - domain[0];
  const spanMonths = spanMs / (1000 * 60 * 60 * 24 * 30);

  let xAxis;
  if (spanMonths <= 18) {
    xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeMonth.every(3))
      .tickFormat(d3.timeFormat("%b %Y"));
  } else {
    xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeYear.every(1))
      .tickFormat(d3.timeFormat("%Y"));
  }

  xAxisG.transition().call(xAxis);
}

// ---- CSV load ----
d3.csv("medicaid_12012025.csv", d3.autoType)
  .then(data => {
    // normalize state names
    data.forEach(d => {
      d.State = normalizeStateName(d.State);
    });

    // restrict years
    data = data.filter(d =>
      d["Enrollment Year"] >= 2014 &&
      d["Enrollment Year"] <= 2021
    );

    // compute Date field
    data.forEach(d => {
      d.date = new Date(d["Enrollment Year"], d["Enrollment Month"] - 1, 1);
    });

    rawData = data;

    // list of states 
    let states = Array.from(new Set(rawData.map(d => d.State)));
    const hasTotals = states.includes("Totals");
    if (hasTotals) {
      states = states.filter(s => s !== "Totals");
      states.sort(d3.ascending);
      states.unshift("Totals");
    } else {
      states.sort(d3.ascending);
    }

    stateSelect.selectAll("option")
      .data(states)
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d => displayStateName(d));

    const defaultState = hasTotals ? "Totals" : states[0];
    stateSelect.property("value", defaultState);
    currentState = defaultState;

    // state dropdown 
    stateSelect.on("change", () => {
      currentState = stateSelect.property("value");
      fullDomain = null;
      focusedCountsId = null;
      focusedShareId  = null;
      updateChart(currentState, currentMode, false);
    });

    // switch between modes
    modeInputs.on("change", (event) => {
      currentMode = event.target.value;
      focusedCountsId = null;
      focusedShareId  = null;
      fullDomain = null;
      updateChart(currentState, currentMode, false);
    });

    // zoom buttons 
    zoomInBtn.on("click", () => {
      zoomByFactor(xScale, fullDomain, 0.5);
      updateChart(currentState, currentMode, true);
    });

    zoomOutBtn.on("click", () => {
      zoomByFactor(xScale, fullDomain, 2);
      updateChart(currentState, currentMode, true);
    });

    zoomResetBtn.on("click", () => {
      resetZoomDomain(xScale, fullDomain);
      updateChart(currentState, currentMode, true);
    });

    // drag for horizontal pan
    overlay.on("mousedown", function(event) {
      if (!fullDomain) return;
      isDragging = true;
      const [mx] = d3.pointer(event, this);
      dragStartX = mx;
      dragStartXDomain = xScale.domain().map(d => new Date(d));
    });

    d3.select(window).on("mouseup", () => {
      isDragging = false;
    });

    overlay
      .on("mousemove", function(event) {
        const [mx] = d3.pointer(event, this);

        // panning (drag)
        if (isDragging && dragStartXDomain && fullDomain) {
          const dx = mx - dragStartX;
          const xSpan = dragStartXDomain[1] - dragStartXDomain[0];
          const offsetMs = -dx / width * xSpan;

          let newStart = new Date(dragStartXDomain[0].getTime() + offsetMs);
          let newEnd   = new Date(dragStartXDomain[1].getTime() + offsetMs);

          if (newStart < fullDomain[0]) {
            newStart = fullDomain[0];
            newEnd = new Date(newStart.getTime() + xSpan);
          }
          if (newEnd > fullDomain[1]) {
            newEnd = fullDomain[1];
            newStart = new Date(newEnd.getTime() - xSpan);
          }

          xScale.domain([newStart, newEnd]);
          updateChart(currentState, currentMode, true);
          return;
        }

        // Tooltip when not dragging
        if (!currentSeriesData.length) return;

        const x0 = xScale.invert(mx);
        const refSeries = currentSeriesData[0];
        if (!refSeries || !refSeries.values.length) return;

        const i = bisectDate(refSeries.values, x0, 1);
        if (i <= 0 || i >= refSeries.values.length) return;

        const d0 = refSeries.values[i - 1];
        const d1 = refSeries.values[i];
        const d = x0 - d0.date > d1.date - x0 ? d1 : d0;
        const dateKey = +d.date;

        let html = `<strong>${displayStateName(currentState)}</strong><br/>${dateFmt(d.date)}<br/>`;

        if (currentMode === "counts") {
          currentSeriesData.forEach(series => {
            const pt = series.values.find(p => +p.date === dateKey);
            if (pt && pt.value != null) {
              html += `${series.label}: ${numFmt(pt.value)}<br/>`;
            }
          });
        } else {
          currentSeriesData.forEach(series => {
            const pt = series.values.find(p => +p.date === dateKey);
            if (pt && pt.value != null) {
              html += `${series.label}: ${pctFmt(pt.value)}%<br/>`;
            }
          });
        }

        tooltip
          .style("opacity", 1)
          .html(html)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 28) + "px");
      })
      .on("mouseleave", () => {
        isDragging = false;
        tooltip.style("opacity", 0);
      });

    // first draw
    updateChart(currentState, currentMode, false);
  })
  .catch(err => {
    console.error("Error loading CSV:", err);
    alert("Cannot load medicaid_12012025.csv. Make sure it is in the same folder and served over HTTP(s).");
  });

// ---- update function ----
function updateChart(stateName, mode, keepXDomain) {
  const stateRows = rawData.filter(d => d.State === stateName);

  if (!stateRows.length) {
    noDataText.style("display", null);
    lineGroup.selectAll("path.series").remove();
    currentSeriesData = [];
    return;
  } else {
    noDataText.style("display", "none");
  }

  stateRows.sort((a, b) => a.date - b.date);

  let seriesDataAll = [];

  if (mode === "counts") {
    chartTitle.text(`Enrollment counts for ${displayStateName(stateName)}`);
    yLabel.text("Number of enrollees");

    seriesDataAll = [
      {
        id: "total",
        label: "Total Medicaid enrollees",
        color: "#1f77b4",
        values: stateRows.map(d => ({
          date: d.date,
          value: d["Total Medicaid Enrollees"]
        })).filter(d => d.value != null && !isNaN(d.value))
      },
      {
        id: "viii",
        label: "VIII group enrollees",
        color: "#ff7f0e",
        values: stateRows.map(d => ({
          date: d.date,
          value: d["Total VIII Group Enrollees"]
        })).filter(d => d.value != null && !isNaN(d.value))
      },
      {
        id: "newly",
        label: "Newly eligible VIII enrollees",
        color: "#2ca02c",
        values: stateRows.map(d => ({
          date: d.date,
          value: d["Total VIII Group Newly Eligible Enrollees"]
        })).filter(d => d.value != null && !isNaN(d.value))
      }
    ];
  } else {
    chartTitle.text(`Expansion share for ${displayStateName(stateName)}`);
    yLabel.text("Expansion share (%)");

    seriesDataAll = [
      {
        id: "share_viii",
        label: "VIII group \u00f7 Total Medicaid",
        color: "#ff7f0e",
        values: stateRows.map(d => {
          const total = d["Total Medicaid Enrollees"];
          const viii = d["Total VIII Group Enrollees"];
          const share = (total && viii) ? (viii / total) * 100 : null;
          return { date: d.date, value: share };
        }).filter(d => d.value != null && !isNaN(d.value))
      },
      {
        id: "share_newly",
        label: "Newly eligible VIII \u00f7 Total Medicaid",
        color: "#2ca02c",
        values: stateRows.map(d => {
          const total = d["Total Medicaid Enrollees"];
          const newly = d["Total VIII Group Newly Eligible Enrollees"];
          const share = (total && newly) ? (newly / total) * 100 : null;
          return { date: d.date, value: share };
        }).filter(d => d.value != null && !isNaN(d.value))
      }
    ];
  }

  currentSeriesData = seriesDataAll;

  if (!seriesDataAll.length || !seriesDataAll[0].values.length) {
    lineGroup.selectAll("path.series").remove();
    noDataText.style("display", null);
    return;
  }

  // full x-domain (unchanged by zooming)
  if (!keepXDomain || !fullDomain) {
    fullDomain = d3.extent(stateRows, d => d.date);
    xScale.domain(fullDomain);
  }

  const domain = xScale.domain();

  // choose series for y-scaling: focused or all
  const focusId = (mode === "counts") ? focusedCountsId : focusedShareId;
  let domainSeries;
  if (focusId) {
    domainSeries = seriesDataAll.filter(s => s.id === focusId);
  } else {
    domainSeries = seriesDataAll;
  }

  const visibleValues = domainSeries.flatMap(s =>
    s.values
      .filter(v => v.date >= domain[0] && v.date <= domain[1])
      .map(v => v.value)
  );

  let minVal = d3.min(visibleValues);
  let maxVal = d3.max(visibleValues);
  if (minVal == null || maxVal == null) {
    minVal = 0;
    maxVal = (mode === "share") ? 100 : 1;
  }

  const range = (maxVal - minVal) || maxVal || 1;
  const padding = range * 0.1;

  if (mode === "share") {
    yScale.domain([
      Math.max(0, minVal - padding),
      Math.min(100, maxVal + padding)
    ]);
  } else {
    yScale.domain([
      Math.max(0, minVal - padding),
      maxVal + padding
    ]);
  }

  drawXAxis();

  if (mode === "share") {
    yAxisG.transition().call(
      d3.axisLeft(yScale).ticks(6).tickFormat(d => d + "%")
    );
  } else {
    yAxisG.transition().call(
      d3.axisLeft(yScale).ticks(6).tickFormat(d3.format(".2s"))
    );
  }

  // ---- legend.js ----
  renderLegend(
    legendG,
    mode,
    legendConfigCounts,
    legendConfigShare,
    focusedCountsId,
    focusedShareId,
    function(legendId) {
      if (mode === "counts") {
        focusedCountsId = (focusedCountsId === legendId) ? null : legendId;
      } else {
        focusedShareId  = (focusedShareId === legendId) ? null : legendId;
      }
      updateChart(currentState, currentMode, true);
    }
  );

  // ---- lines ----
  const lines = lineGroup.selectAll("path.series")
    .data(seriesDataAll, d => d.id);

  lines.enter()
    .append("path")
    .attr("class", d => `line series ${d.id}`)
    .attr("stroke", d => d.color)
    .merge(lines)
    .transition()
    .attr("d", d => lineGenerator(d.values))
    .style("opacity", d => {
      const focus = (mode === "counts") ? focusedCountsId : focusedShareId;
      return focus && d.id !== focus ? 0.25 : 1;
    });

  lines.exit().remove();
}

