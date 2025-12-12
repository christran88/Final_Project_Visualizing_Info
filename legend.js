// Create the legend group once
function initLegend(chartG) {
  return chartG.append("g")
    .attr("class", "legend")
    .attr("transform", "translate(0,-30)");
}

/**
 * Render legend for current mode.
 * - legendG: <g> selection
 * - mode: "counts" | "share"
 * - legendConfigCounts / legendConfigShare: arrays of {id, label, color}
 * - focusedCountsId / focusedShareId: current focused series IDs
 * - onLegendClick(id): callback when a legend item is clicked
 */
function renderLegend(
  legendG,
  mode,
  legendConfigCounts,
  legendConfigShare,
  focusedCountsId,
  focusedShareId,
  onLegendClick
) {
  const legendConfig = (mode === "counts")
    ? legendConfigCounts
    : legendConfigShare;

  const legendItems = legendG.selectAll("g.legend-item")
    .data(legendConfig, d => d.id);

  const legendEnter = legendItems.enter()
    .append("g")
    .attr("class", "legend-item");

  legendEnter.append("rect")
    .attr("x", 0)
    .attr("y", -10)
    .attr("width", 12)
    .attr("height", 12);

  legendEnter.append("text")
    .attr("x", 18)
    .attr("y", 0)
    .attr("alignment-baseline", "middle");

  const legendMerge = legendEnter.merge(legendItems)
    .attr("transform", (d, i) => `translate(${i * 250},0)`);

  legendMerge.select("rect").attr("fill", d => d.color);
  legendMerge.select("text").text(d => d.label);

  legendMerge.on("click", (event, d) => {
    if (typeof onLegendClick === "function") {
      onLegendClick(d.id);
    }
  });

  legendItems.exit().remove();

  // Dim non-focused items if something is focused
  legendG.selectAll("g.legend-item")
    .classed("dim", d => {
      const focus = (mode === "counts") ? focusedCountsId : focusedShareId;
      return focus && d.id !== focus;
    });
}
