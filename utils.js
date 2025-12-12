// Helper to normalize messy state names
function normalizeStateName(name) {
  if (!name) return name;
  let cleaned = name.replace(/\*/g, "").trim();
  const lower = cleaned.toLowerCase();

  // American Samoa variations
  if (lower.startsWith("amer.") && lower.includes("samoa")) {
    return "American Samoa";
  }
  if (lower === "american samoa") {
    return "American Samoa";
  }

  // District of Columbia variations
  if (lower.startsWith("dist.") && lower.includes("col")) {
    return "District of Columbia";
  }
  if (lower === "district of columbia" || lower === "district of columbia.") {
    return "District of Columbia";
  }

  return cleaned;
}

// Label for dropdown
function displayStateName(s) {
  return s === "Totals" ? "United States (total)" : s;
}

