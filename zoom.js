function zoomByFactor(xScale, fullDomain, factor) {
  if (!fullDomain) return;

  const domain = xScale.domain();
  const center = (domain[0].getTime() + domain[1].getTime()) / 2;
  const span = domain[1] - domain[0];
  const fullSpan = fullDomain[1] - fullDomain[0];

  let newSpan = span * factor;
  const minSpan = 1000 * 60 * 60 * 24 * 90; // ~3 months
  const maxSpan = fullSpan;

  if (factor < 1 && newSpan < minSpan) newSpan = minSpan;
  if (factor > 1 && newSpan > maxSpan) newSpan = maxSpan;

  let newStart = new Date(center - newSpan / 2);
  let newEnd = new Date(center + newSpan / 2);

  if (newStart < fullDomain[0]) {
    newStart = fullDomain[0];
    newEnd = new Date(newStart.getTime() + newSpan);
  }
  if (newEnd > fullDomain[1]) {
    newEnd = fullDomain[1];
    newStart = new Date(newEnd.getTime() - newSpan);
  }

  xScale.domain([newStart, newEnd]);
}


function resetZoomDomain(xScale, fullDomain) {
  if (!fullDomain) return;
  xScale.domain(fullDomain);
}

