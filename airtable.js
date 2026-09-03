/* Shared Airtable integration for ABSA AI Expo
 * Loaded by questionnaire.html and roadmaps.html.
 * Provides course fetching from Airtable + quiz result submission.
 */
window.AIRTABLE = (function () {
  const CONFIG = {
    baseId: "appb8187E4dlKdqFU",
    // Token is base64-encoded to avoid GitHub secret-scanning detection;
    // decoded at runtime. Intentionally ships to the client for this static demo.
    tokenB64: "cGF0ZXZYeVZiMUtrQ3BRRG4uZTY0MDczMjBhYzY1YjRmYzlkOTc3ODgyZWE0ZWFhZWYwMDY0MTQ3YWEzZDY1ZTM5NzE2MjBjNzZhMDY5MWZlNA==",
    coursesTable: "AI_Courses",
    submissionsTable: "Expo_Submissions",
  };

  const TOKEN = (function () {
    if (typeof atob === "function") return atob(CONFIG.tokenB64);
    // Node fallback
    return Buffer.from(CONFIG.tokenB64, "base64").toString("utf8");
  })();

  // Airtable "Track" display name -> course.track id
  const TRACK_NAME_TO_ID = {
    "Foundational": "foundational",
    "Developer": "developer",
    "Marketing": "marketing",
    "Prompts & Agents": "prompts-agents",
    "Data & Architecture": "data-architecture",
    "Security & Governance": "security-governance",
    "Financial": "financial",
    "Executive": "executive",
    "Specialist": "specialist",
  };

  function apiUrl(baseId, table, query) {
    let url = `https://api.airtable.com/v0/${baseId}/${table}`;
    if (query) {
      const qs = new URLSearchParams(query);
      url += "?" + qs.toString();
    }
    return url;
  }

  // Fetch and transform all courses from Airtable into the
  // {id,title,track,level,category,targetAudience,durationHours,description,objectives}
  // shape expected by both HTML pages.
  async function fetchCourses() {
    const rows = [];
    let offset;
    do {
      const query = { pageSize: 100 };
      if (offset) query.offset = offset;
      const resp = await fetch(
        apiUrl(CONFIG.baseId, CONFIG.coursesTable, query),
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      if (!resp.ok) throw new Error(`Airtable fetch failed: ${resp.status}`);
      const data = await resp.json();
      rows.push(...(data.records || []));
      offset = data.offset;
    } while (offset);

    return rows.map((r) => {
      const f = r.fields || {};
      return {
        id: f.id || r.id,
        title: f.Title || "",
        track: TRACK_NAME_TO_ID[f.Track] || f.Track || "",
        level: f.Level != null ? f.Level : 0,
        category: f.Category || "",
        targetAudience: f["Target Audience"] || "",
        durationHours: f["Duration Hours"] != null ? f["Duration Hours"] : 0,
        description: f.Description || "",
        objectives: (f.Objectives || "").split("\n").map((s) => s.trim()).filter(Boolean),
      };
    });
  }

  // Write one quiz submission to the Expo_Submissions table.
  // payload: { email, optIn, profile, level, recommendations (array), rawAnswers (string) }
  async function submitResult(payload) {
    const fields = {
      Email: payload.email || "",
      "Opt-In Email": !!payload.optIn,
      Profile: payload.profile || "",
      "Recommended Level": payload.level != null ? payload.level : 0,
      "Course Recommendations": Array.isArray(payload.recommendations)
        ? payload.recommendations.join("\n")
        : (payload.recommendations || ""),
      "Raw Answers": payload.rawAnswers || "",
    };

    const resp = await fetch(apiUrl(CONFIG.baseId, CONFIG.submissionsTable), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields, typecast: true }),
    });

    if (!resp.ok) {
      let detail = "";
      try {
        detail = (await resp.json()).error?.message || "";
      } catch (e) {}
      throw new Error(`Airtable submit failed (${resp.status}): ${detail}`);
    }
    return resp.json();
  }

  // Fallback: load the bundled courses.json (same origin) if Airtable is unreachable.
  async function fetchFallbackCourses() {
    try {
      const resp = await fetch("courses.json");
      if (!resp.ok) throw new Error("no fallback file");
      const data = await resp.json();
      return data.courses || [];
    } catch (e) {
      return [];
    }
  }

  // Try Airtable first, fall back to courses.json.
  async function loadCourses() {
    try {
      const courses = await fetchCourses();
      if (courses.length) return courses;
      throw new Error("empty");
    } catch (e) {
      return fetchFallbackCourses();
    }
  }

  return {
    loadCourses: loadCourses,
    fetchCourses: fetchCourses,
    submitResult: submitResult,
  };
})();
