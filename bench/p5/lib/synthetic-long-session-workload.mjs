import fs from "node:fs";

export const P5A_INTERACTIONS = [
  "typing_proxy",
  "send_click_proxy",
  "scroll_jump_return"
];

export const P5A_BASELINE_INVENTORY = [
  {
    baseline_id: "B0",
    name: "naive DOM",
    status: "exists",
    likely_files: [
      "bench/p0/targets/controlled_append_surface.html",
      "bench/p0/targets/controlled_batch_commit_surface.html",
      "bench/p0f/targets/p0f_proxy_baseline_surface.html"
    ],
    current_limitation:
      "Existing targets cover append and batch/full-DOM scan pieces, but not the unified P5 long-session workload.",
    next_required_patch: "Implement the first P5 measurable naive DOM target against the P5-A generator."
  },
  {
    baseline_id: "B1",
    name: "optimized/batched DOM",
    status: "partial",
    likely_files: [
      "bench/p0f/targets/p0f_proxy_baseline_surface.html"
    ],
    current_limitation:
      "The optimized DOM proxy exists as a prior controlled target, but it does not yet run the P5 send/typing/scroll workload.",
    next_required_patch: "Add an optimized/batched DOM mode after the B0 P5 target exists."
  },
  {
    baseline_id: "B2",
    name: "virtualized DOM",
    status: "partial",
    likely_files: [
      "bench/p0f/targets/p0f_proxy_baseline_surface.html"
    ],
    current_limitation:
      "The virtualized proxy exists, but the P5 workload still needs explicit visible-history and active-context axes.",
    next_required_patch:
      "Add a P5 virtualized DOM target with logical-full coordination and bounded rendered window accounting."
  },
  {
    baseline_id: "B3",
    name: "editor/log-style baseline",
    status: "partial",
    likely_files: [
      "bench/p0f/targets/p0f_proxy_baseline_surface.html"
    ],
    current_limitation:
      "Only a no-dependency text-buffer proxy exists; no editor or terminal-grade dependency is wired into P5.",
    next_required_patch: "Decide whether to add a true editor/log baseline after B0/B1/B2 are measurable."
  },
  {
    baseline_id: "R0",
    name: "P3-derived runtime path",
    status: "partial",
    likely_files: [
      "runtime/core/projection-policy.ts",
      "runtime/core/scheduler-policy.ts",
      "runtime/main/main-projection-adapter.ts",
      "runtime/worker/worker-message-handler.ts"
    ],
    current_limitation:
      "P3 runtime seams exist, but no P5 measurable browser target or R0 comparison path has been implemented.",
    next_required_patch:
      "Implement an R0 P5 comparison target only after the first measurable baseline target is accepted."
  }
];

const ACTIVE_CONTEXT_WINDOWS = {
  small: 128,
  medium: 1000
};

const BANNED_CONTENT_PATTERNS = [
  /chatgpt/i,
  /claude/i,
  /gemini/i,
  /openai/i,
  /https?:\/\//i,
  /account[_ -]?id/i,
  /message[_ -]?id/i,
  /password/i,
  /secret/i,
  /api[_ -]?key/i,
  /bearer/i,
  /@/
];

export function loadP5AMatrix(matrixPath) {
  if (typeof matrixPath !== "string" && !(matrixPath instanceof URL)) {
    throw new TypeError("matrixPath must be a string path or URL");
  }

  return JSON.parse(fs.readFileSync(matrixPath, "utf8"));
}

export function expandP5AScenarios(matrix) {
  if (typeof matrix !== "object" || matrix == null || Array.isArray(matrix)) {
    throw new TypeError("matrix must be an object");
  }

  if (!Array.isArray(matrix.scenarios)) {
    throw new TypeError("matrix.scenarios must be an array");
  }

  return matrix.scenarios.map((scenario) => normalizeScenario(scenario, matrix.scenario_defaults));
}

export function generateSyntheticLongSessionWorkload(scenarioInput) {
  const scenario = normalizeScenario(scenarioInput);
  const artifactOrdinals = buildArtifactOrdinalSet(
    scenario.visible_block_count,
    scenario.artifact_placeholder_ratio
  );
  const blocks = buildBlocks(scenario, artifactOrdinals);
  const activeContextStartOrdinal = scenario.visible_block_count - scenario.active_context_window + 1;
  const activeContextIndex = buildActiveContextIndex(blocks, activeContextStartOrdinal);
  const appendStream = buildAppendStream(scenario);
  const tailMutations = buildTailMutations(scenario);
  const recallProbes = buildRecallProbes(scenario, activeContextStartOrdinal);
  const artifactPlaceholders = buildArtifactPlaceholders(blocks, artifactOrdinals);
  const interactions = buildInteractions(scenario);

  return {
    schema_version: "p5a.synthetic-long-session-workload.v0",
    scenario_id: scenario.scenario_id,
    visible_block_count: scenario.visible_block_count,
    active_context_mode: scenario.active_context_mode,
    active_context_window: scenario.active_context_window,
    active_context_start_ordinal: activeContextStartOrdinal,
    append_batch_size: scenario.append_batch_size,
    tail_mutation_count: scenario.tail_mutation_count,
    recall_probe_count: scenario.recall_probe_count,
    artifact_placeholder_ratio: scenario.artifact_placeholder_ratio,
    expected_artifact_placeholder_count: artifactOrdinals.size,
    synthetic_content_only: true,
    blocks,
    active_context_index: activeContextIndex,
    append_stream: appendStream,
    tail_mutations: tailMutations,
    recall_probes: recallProbes,
    artifact_placeholders: artifactPlaceholders,
    interactions
  };
}

export function summarizeP5AWorkload(workload) {
  return {
    scenario_id: workload.scenario_id,
    visible_block_count: workload.visible_block_count,
    active_context_mode: workload.active_context_mode,
    active_context_window: workload.active_context_window,
    active_context_start_ordinal: workload.active_context_start_ordinal,
    block_count: workload.blocks.length,
    append_stream_count: workload.append_stream.length,
    tail_mutation_count: workload.tail_mutations.length,
    recall_probe_count: workload.recall_probes.length,
    artifact_placeholder_count: workload.artifact_placeholders.length,
    interaction_count: workload.interactions.length,
    interaction_types: workload.interactions.map((interaction) => interaction.interaction_type)
  };
}

export function auditP5AWorkload(workload) {
  const errors = [];

  if (workload.visible_block_count !== workload.blocks.length) {
    errors.push(
      `visible_block_count ${workload.visible_block_count} does not match blocks length ${workload.blocks.length}`
    );
  }

  if (workload.active_context_window > workload.visible_block_count) {
    errors.push("active_context_window exceeds visible_block_count");
  }

  if (
    workload.active_context_mode === "full" &&
    workload.active_context_window !== workload.visible_block_count
  ) {
    errors.push("full active_context_window must equal visible_block_count");
  }

  const activeStart = workload.visible_block_count - workload.active_context_window + 1;
  if (workload.active_context_start_ordinal !== activeStart) {
    errors.push("active_context_start_ordinal does not match active_context_window");
  }

  const blockById = new Map(workload.blocks.map((block) => [block.block_id, block]));
  for (const probe of workload.recall_probes) {
    const block = blockById.get(probe.block_id);
    if (block == null) {
      errors.push(`recall probe ${probe.probe_id} references missing block ${probe.block_id}`);
      continue;
    }

    if (block.ordinal < activeStart || block.ordinal > workload.visible_block_count) {
      errors.push(`recall probe ${probe.probe_id} references block outside active context`);
    }
  }

  const tailStart = workload.visible_block_count - workload.tail_mutations.length + 1;
  for (const mutation of workload.tail_mutations) {
    const block = blockById.get(mutation.block_id);
    if (block == null) {
      errors.push(`tail mutation ${mutation.mutation_id} references missing block ${mutation.block_id}`);
      continue;
    }

    if (block.ordinal < tailStart || block.ordinal > workload.visible_block_count) {
      errors.push(`tail mutation ${mutation.mutation_id} references block outside tail range`);
    }
  }

  const expectedArtifactCount = expectedArtifactPlaceholderCount(
    workload.visible_block_count,
    workload.artifact_placeholder_ratio
  );
  if (workload.artifact_placeholders.length !== expectedArtifactCount) {
    errors.push(
      `artifact placeholder count ${workload.artifact_placeholders.length} does not match expected ${expectedArtifactCount}`
    );
  }

  if (workload.expected_artifact_placeholder_count !== expectedArtifactCount) {
    errors.push("expected_artifact_placeholder_count does not match deterministic rule");
  }

  const unsafeContentPath = firstUnsafeContentPath(workload);
  if (unsafeContentPath != null) {
    errors.push(`generated content failed synthetic/private-string check at ${unsafeContentPath}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: summarizeP5AWorkload(workload)
  };
}

export function getP5ABaselineInventory() {
  return P5A_BASELINE_INVENTORY.map((entry) => ({
    baseline_id: entry.baseline_id,
    name: entry.name,
    status: entry.status,
    likely_files: [...entry.likely_files],
    current_limitation: entry.current_limitation,
    next_required_patch: entry.next_required_patch
  }));
}

function normalizeScenario(input, defaults = {}) {
  if (typeof input !== "object" || input == null || Array.isArray(input)) {
    throw new TypeError("scenario must be an object");
  }

  const scenario = {
    ...input,
    interactions: input.interactions ?? defaults.interactions ?? P5A_INTERACTIONS
  };

  const requiredStringFields = ["scenario_id", "active_context_mode"];
  for (const field of requiredStringFields) {
    if (typeof scenario[field] !== "string" || scenario[field] === "") {
      throw new TypeError(`scenario.${field} must be a non-empty string`);
    }
  }

  const requiredIntegerFields = [
    "visible_block_count",
    "active_context_window",
    "append_batch_size",
    "tail_mutation_count",
    "recall_probe_count"
  ];
  for (const field of requiredIntegerFields) {
    assertPositiveInteger(scenario[field], `scenario.${field}`);
  }

  if (!["small", "medium", "full"].includes(scenario.active_context_mode)) {
    throw new TypeError(`invalid active_context_mode: ${scenario.active_context_mode}`);
  }

  if (scenario.active_context_mode === "full") {
    if (scenario.active_context_window !== scenario.visible_block_count) {
      throw new TypeError("full active_context_window must equal visible_block_count");
    }
  } else if (scenario.active_context_window !== ACTIVE_CONTEXT_WINDOWS[scenario.active_context_mode]) {
    throw new TypeError(
      `${scenario.active_context_mode} active_context_window must equal ${ACTIVE_CONTEXT_WINDOWS[scenario.active_context_mode]}`
    );
  }

  if (scenario.active_context_window > scenario.visible_block_count) {
    throw new TypeError("active_context_window cannot exceed visible_block_count");
  }

  if (!Number.isFinite(scenario.artifact_placeholder_ratio) || scenario.artifact_placeholder_ratio < 0) {
    throw new TypeError("scenario.artifact_placeholder_ratio must be a non-negative number");
  }

  if (!Array.isArray(scenario.interactions) || scenario.interactions.length === 0) {
    throw new TypeError("scenario.interactions must be a non-empty array");
  }

  const missingInteractions = P5A_INTERACTIONS.filter(
    (interaction) => !scenario.interactions.includes(interaction)
  );
  if (missingInteractions.length > 0) {
    throw new TypeError(`scenario.interactions missing required interactions: ${missingInteractions.join(", ")}`);
  }

  return scenario;
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
}

function buildArtifactOrdinalSet(visibleBlockCount, ratio) {
  const count = expectedArtifactPlaceholderCount(visibleBlockCount, ratio);
  const ordinals = new Set();
  for (let index = 1; index <= count; index += 1) {
    ordinals.add(Math.floor((index * visibleBlockCount) / (count + 1)) + 1);
  }

  return ordinals;
}

function expectedArtifactPlaceholderCount(visibleBlockCount, ratio) {
  return Math.floor(visibleBlockCount * ratio);
}

function buildBlocks(scenario, artifactOrdinals) {
  const blocks = [];
  for (let ordinal = 1; ordinal <= scenario.visible_block_count; ordinal += 1) {
    const blockId = formatId("block", ordinal);
    const isArtifactPlaceholder = artifactOrdinals.has(ordinal);
    blocks.push({
      block_id: blockId,
      ordinal,
      kind: isArtifactPlaceholder ? "artifact_placeholder" : "message",
      synthetic_key: `synthetic-key-${String(ordinal).padStart(6, "0")}`,
      estimated_bytes: 256 + (ordinal % 17),
      text: `Synthetic harmless block ${String(ordinal).padStart(6, "0")} for deterministic long-session workload.`
    });
  }

  return blocks;
}

function buildActiveContextIndex(blocks, activeContextStartOrdinal) {
  return blocks
    .filter((block) => block.ordinal >= activeContextStartOrdinal)
    .map((block, index) => ({
      context_index: index,
      block_id: block.block_id,
      ordinal: block.ordinal,
      synthetic_key: block.synthetic_key,
      metadata_weight: 1 + (block.ordinal % 5)
    }));
}

function buildAppendStream(scenario) {
  const stream = [];
  for (let index = 1; index <= scenario.append_batch_size; index += 1) {
    const ordinal = scenario.visible_block_count + index;
    stream.push({
      append_id: formatId("append", index),
      ordinal,
      kind: "stream_append",
      text: `Synthetic append unit ${String(index).padStart(4, "0")} after visible history ${scenario.visible_block_count}.`
    });
  }

  return stream;
}

function buildTailMutations(scenario) {
  const mutations = [];
  const tailStart = scenario.visible_block_count - scenario.tail_mutation_count + 1;
  for (let ordinal = tailStart; ordinal <= scenario.visible_block_count; ordinal += 1) {
    const mutationOrdinal = ordinal - tailStart + 1;
    mutations.push({
      mutation_id: formatId("tail-mutation", mutationOrdinal),
      block_id: formatId("block", ordinal),
      ordinal,
      patch_kind: "replace_tail_summary",
      replacement_text: `Synthetic tail update ${String(mutationOrdinal).padStart(4, "0")}.`
    });
  }

  return mutations;
}

function buildRecallProbes(scenario, activeContextStartOrdinal) {
  const probes = [];
  for (let index = 1; index <= scenario.recall_probe_count; index += 1) {
    const offset = ((index - 1) * 37) % scenario.active_context_window;
    const ordinal = activeContextStartOrdinal + offset;
    probes.push({
      probe_id: formatId("recall-probe", index),
      block_id: formatId("block", ordinal),
      ordinal,
      expected_synthetic_key: `synthetic-key-${String(ordinal).padStart(6, "0")}`
    });
  }

  return probes;
}

function buildArtifactPlaceholders(blocks, artifactOrdinals) {
  return blocks
    .filter((block) => artifactOrdinals.has(block.ordinal))
    .map((block, index) => ({
      artifact_id: formatId("artifact-placeholder", index + 1),
      block_id: block.block_id,
      ordinal: block.ordinal,
      surface_route: "separate-surface-placeholder",
      placeholder_text: `Synthetic artifact placeholder ${String(index + 1).padStart(4, "0")}.`
    }));
}

function buildInteractions(scenario) {
  return scenario.interactions.map((interactionType, index) => {
    if (interactionType === "typing_proxy") {
      return {
        interaction_type: interactionType,
        interaction_id: formatId("interaction", index + 1),
        event_count: 12,
        target_block_id: formatId("block", scenario.visible_block_count)
      };
    }

    if (interactionType === "send_click_proxy") {
      return {
        interaction_type: interactionType,
        interaction_id: formatId("interaction", index + 1),
        event_count: 1,
        active_context_window: scenario.active_context_window
      };
    }

    if (interactionType === "scroll_jump_return") {
      return {
        interaction_type: interactionType,
        interaction_id: formatId("interaction", index + 1),
        event_count: 2,
        jump_to_block_id: formatId("block", Math.max(1, Math.floor(scenario.visible_block_count * 0.1))),
        return_to_block_id: formatId("block", scenario.visible_block_count)
      };
    }

    return {
      interaction_type: interactionType,
      interaction_id: formatId("interaction", index + 1),
      event_count: 1
    };
  });
}

function firstUnsafeContentPath(value, path = "$") {
  if (typeof value === "string") {
    return BANNED_CONTENT_PATTERNS.some((pattern) => pattern.test(value)) ? path : null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const unsafePath = firstUnsafeContentPath(value[index], `${path}[${index}]`);
      if (unsafePath != null) {
        return unsafePath;
      }
    }

    return null;
  }

  if (typeof value === "object" && value != null) {
    for (const [key, nestedValue] of Object.entries(value)) {
      const unsafePath = firstUnsafeContentPath(nestedValue, `${path}.${key}`);
      if (unsafePath != null) {
        return unsafePath;
      }
    }
  }

  return null;
}

function formatId(prefix, ordinal) {
  return `${prefix}-${String(ordinal).padStart(6, "0")}`;
}
