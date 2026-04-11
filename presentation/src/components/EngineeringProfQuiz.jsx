import { useState, useMemo, useCallback } from "react";

// ─── Palette (matches presentation theme) ───────────────────────────────────
const C = {
  bg: "#0B1120",
  surface: "#111827",
  border: "rgba(124,141,176,0.15)",
  amber: "#E8A838",
  amberDim: "rgba(232,168,56,0.12)",
  amberBorder: "rgba(232,168,56,0.25)",
  blue: "#5BA4CF",
  blueDim: "rgba(91,164,207,0.10)",
  blueBorder: "rgba(91,164,207,0.20)",
  green: "#48BB78",
  greenDim: "rgba(72,187,120,0.10)",
  greenBorder: "rgba(72,187,120,0.25)",
  red: "#FC8181",
  redDim: "rgba(252,129,129,0.10)",
  redBorder: "rgba(252,129,129,0.25)",
  text: "#C8D6E5",
  muted: "#8896A7",
  dim: "#4A5568",
  mono: "'IBM Plex Mono', monospace",
  sans: "'IBM Plex Sans', system-ui, sans-serif",
};

// ─── Quiz Data ────────────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: "attention",
    title: "Self-Attention Mechanism",
    subtitle: "Query · Key · Value computation and coreference resolution",
    icon: "⊗",
  },
  {
    id: "weights",
    title: "Where Weights Come From",
    subtitle: "Training corpus co-occurrence and predictive utility",
    icon: "∇",
  },
  {
    id: "dilution",
    title: "Attention Dilution",
    subtitle: "Noise, softmax probability mass, and layer compounding",
    icon: "∿",
  },
  {
    id: "density",
    title: "Context Density",
    subtitle: "Information per token and dimension resolution",
    icon: "◈",
  },
  {
    id: "features",
    title: "Feature Activation Landscape",
    subtitle: "Layer-wise sharpening and contextual disambiguation",
    icon: "△",
  },
  {
    id: "output",
    title: "How Landscape Impacts Output",
    subtitle: "Training defaults, Top-K sampling, and confabulation pathways",
    icon: "⊞",
  },
  {
    id: "hallucination",
    title: "Hallucination Map",
    subtitle: "Grounding taxonomy and token-level confidence",
    icon: "◉",
  },
  {
    id: "confidence",
    title: "Confidence Landscape",
    subtitle: "Winner vs. runner-up topology and entropy diagnostics",
    icon: "⬡",
  },
  {
    id: "dissociating",
    title: "Language vs. Thought",
    subtitle: "Formal competence, functional competence, and brain networks",
    icon: "⊘",
  },
];

const QUESTIONS = [
  // ── Section 1: Self-Attention ────────────────────────────────────────────
  {
    section: 0,
    q: `A transformer processes the sentence "The vaccine prevented the disease, but it caused mild fever." Analysis of one attention head shows a weight of 0.68 from "it" to "vaccine" and 0.11 from "it" to "disease." Which claim most precisely describes what this weight pattern encodes?`,
    options: [
      `The model has memorised this exact sentence from its training corpus.`,
      `The head has learned a coreference heuristic: the pronoun attends to the nearest plausible antecedent that is the causal agent of the following predicate.`,
      `The weight difference reflects the order of the nouns in the sentence rather than semantic content.`,
      `High attention weight from "it" to "vaccine" means the model will always output vaccine-related text next.`,
    ],
    answer: 1,
    explanation:
      `"It" corefers to the causal agent of "caused"—"vaccine" is that agent. The head has encoded a learned association between agent-role pronouns and their antecedents via gradient updates over billions of similar constructions. The weight difference is not positional (disease is closer) nor an exact-match retrieval; it reflects crystallised syntactic-semantic structure.`,
  },
  {
    section: 0,
    q: `In the scaled dot-product attention formula, raw Q·K scores are divided by √d before softmax. A researcher experiments with removing this scaling on a 1024-dimensional model. The most mechanistically precise prediction is:`,
    options: [
      `Attention weights become uniform because all scores collapse to zero.`,
      `Dot products grow proportionally to the embedding dimension, driving softmax toward one-hot distributions and producing near-zero gradients that halt learning for the non-dominant entries.`,
      `The model becomes more accurate because larger scores give sharper, more informative attention.`,
      `Training speed increases because fewer floating-point operations are needed per forward pass.`,
    ],
    answer: 1,
    explanation:
      `In high-dimensional spaces, the variance of Q·K scales with d. Without √d normalisation the extreme magnitudes saturate softmax, collapsing it toward a one-hot peak. The resulting near-zero gradients on all other positions prevent those attention pathways from being updated—effectively starving the model of learning signal for all but one key.`,
  },
  {
    section: 0,
    q: `A sparsification study prunes all attention weights below 0.04 and redistributes their probability mass to the remaining weights. Factual recall improves by 6%, but syntactic agreement accuracy drops by 3%. The most coherent mechanistic interpretation is:`,
    options: [
      `Pruning introduced a bug that selectively damages syntactic computation.`,
      `Long-range factual associations (e.g., subject coreference across paragraphs) are carried by a small number of high-weight connections, while short-range syntactic agreement relies on many low-weight diffuse connections that the pruning destroyed.`,
      `Softmax renormalisation after pruning artificially inflates remaining weights, causing the model to over-attend to facts.`,
      `Factual recall and syntactic agreement share the same attention head, so improvements to one always degrade the other.`,
    ],
    answer: 1,
    explanation:
      `Factual recall is dominated by a sparse set of high-confidence associations; removing sub-threshold noise sharpens those. Syntactic agreement, however, is often distributed: many weak, short-range weights collectively encode agreement constraints. Pruning those sub-threshold weights eliminates the distributed syntactic signal while preserving the sparse factual peaks.`,
  },

  // ── Section 2: Weight Origins ─────────────────────────────────────────────
  {
    section: 1,
    q: `An LLM is pre-trained on a corpus where "broker" and "commission" co-occur in 38% of sentences. It is then fine-tuned on climate science papers where "broker" always appears as "carbon broker" near "offset" and "sequestration." After fine-tuning, which weight pattern is most likely?`,
    options: [
      `"broker → commission" weight resets to uniform because fine-tuning overwrites all pre-training associations.`,
      `"broker → commission" partially persists as a residual but "broker → offset" and "broker → sequestration" emerge as newly dominant weights in domain-specific contexts.`,
      `Fine-tuning has no effect on attention weights; only the feed-forward layers are updated.`,
      `"broker → commission" increases further because the financial domain is statistically overrepresented in pre-training relative to climate science.`,
    ],
    answer: 1,
    explanation:
      `Weights are not binary; gradient updates during fine-tuning incrementally shift rather than overwrite them. The high pre-training co-occurrence with "commission" leaves a residual, but repeated exposure to climate-science constructions during fine-tuning grows competing weights. The result is a bimodal distribution that depends on the activating context.`,
  },
  {
    section: 1,
    q: `In a controlled experiment, two corpora are constructed: Corpus A contains "nurse" adjacent to "caring," "gentle," and "patient" in 80% of sentences; Corpus B contains "nurse" adjacent to "analytical," "decisive," and "systematic" in 80% of sentences. Models trained on each corpus are compared on a coreference resolution task. Which prediction follows directly from the weight-formation mechanism?`,
    options: [
      `Both models perform identically because coreference resolution does not depend on adjectival associations.`,
      `The Corpus A model will resolve "the nurse who was [adjective] helped" differently than the Corpus B model, because the adjective–nurse attention weight encodes corpus-specific co-occurrence rather than a universal semantic truth.`,
      `The Corpus B model will outperform because analytical descriptors provide stronger Q·K signal.`,
      `Both models will fail because adjective-noun associations are stored in feed-forward layers, not attention weights.`,
    ],
    answer: 1,
    explanation:
      `Attention weights crystallise statistical co-occurrence in the training corpus. The two models will develop fundamentally different attention profiles for "nurse → adjective" pairs. This is not a flaw—it is the mechanism—but it demonstrates that weights reflect training data distributions, not universal semantic ground truth.`,
  },
  {
    section: 1,
    q: `A weight-analysis tool shows that "and" achieves high raw co-occurrence frequency with nearly every content word in a 100-billion-token corpus, yet develops consistently low attention weights in final trained models. Why?`,
    options: [
      `Conjunctions are excluded from the vocabulary during tokenisation.`,
      `Co-occurrence frequency is not the proximate cause of weight magnitude; predictive utility is. Attending to "and" rarely reduces next-token uncertainty because it co-occurs indiscriminately, yielding near-zero gradient signal for that attention path.`,
      `The model assigns low weights to all function words as a pre-programmed architectural bias.`,
      `"And" has a short token length, and weight magnitude scales with token length in byte-pair encoding.`,
    ],
    answer: 1,
    explanation:
      `Gradient updates are driven by prediction error reduction. If attending to "and" doesn't help the model predict the next token any better than not attending, the error signal through that pathway is weak, and the weight converges near zero. High raw frequency is neither necessary nor sufficient for high attention weight—predictive leverage is.`,
  },

  // ── Section 3: Attention Dilution ─────────────────────────────────────────
  {
    section: 2,
    q: `A retrieval-augmented system appends 3,000 tokens of retrieved passages to a 50-token user query before sending both to the model. The retrieved passages are genuinely relevant but contain many bridging sentences (transitions, summaries, boilerplate). Compared to sending only the 50-token query, what is the most mechanistically precise prediction about attention on the query tokens?`,
    options: [
      `Attention on query tokens is unchanged because the model learns to ignore padding.`,
      `Attention weight on query tokens decreases proportionally, because the softmax denominator now includes 3,050 terms; even low-relevance bridging sentences claim non-zero probability mass, diluting the signal from the query.`,
      `Attention on query tokens increases because longer context provides more anchoring signal.`,
      `The model uses positional encoding to always prioritise the first 50 tokens regardless of context length.`,
    ],
    answer: 1,
    explanation:
      `Softmax distributes probability across all positions. Bridging sentences may have small Q·K scores relative to query tokens, but their exponentials still contribute to the denominator. With 3,000 additional terms, the cumulative mass claimed by low-relevance tokens can substantially erode the share available to the high-signal 50-token query.`,
  },
  {
    section: 2,
    q: `An experiment adds 30 tokens of random noise to each input and measures accuracy. It then repeats with the noise inserted at the beginning versus the end of the sequence. The finding is that end-inserted noise causes greater accuracy degradation than beginning-inserted noise. What mechanism most plausibly explains this asymmetry?`,
    options: [
      `Positional encodings assign lower weights to tokens at the end of a sequence.`,
      `In causal (decoder-only) models, each token can only attend to preceding positions; end-inserted noise appears as context for no tokens, whereas beginning-inserted noise is in the attention window of all subsequent tokens, causing earlier and more pervasive dilution.`,
      `The tokeniser assigns higher-frequency IDs to tokens at the end, increasing their softmax scores.`,
      `End-inserted noise increases the total sequence length, triggering a memory bottleneck.`,
    ],
    answer: 1,
    explanation:
      `In autoregressive transformers with causal masking, a token at position i can attend to all positions ≤ i. Noise inserted at the beginning of the sequence is in the receptive field of every subsequent token—every attention computation includes it in the denominator. End-inserted noise only dilutes the attention of tokens that come after it, which may be zero or few.`,
  },
  {
    section: 2,
    q: `Why does attention dilution from noise compound across transformer layers rather than self-correcting, even though each layer performs its own softmax normalisation?`,
    options: [
      `Layer normalisation removes any signal recovered by later attention heads.`,
      `Each layer receives as input the value-blended representations from the previous layer. Once early-layer attention has mixed noise into a token's representation, that corrupted representation is what subsequent layers attend to—the original clean embedding is no longer accessible.`,
      `Softmax normalisation is only applied in the first and last layers; intermediate layers use linear normalisation.`,
      `Later layers have smaller weight matrices that can store less information, amplifying early errors.`,
    ],
    answer: 1,
    explanation:
      `Transformer layers are sequential: the output of layer L is the input to layer L+1. If layer 1 attention has already blended noise into a token's contextualised representation, the residual stream passed to layer 2 carries that contamination. No later layer can recover signal that was never written into the representation; the original token embedding is overwritten, not preserved in parallel.`,
  },

  // ── Section 4: Context Density ────────────────────────────────────────────
  {
    section: 3,
    q: `A project manager writes this prompt: "I would really appreciate it if you could perhaps help me think through the general approach we might want to take when considering how to structure the onboarding flow for new users of our platform." A developer rewrites it as: "Design a 3-step onboarding flow for new users: account creation → feature tour → first-action nudge." Which statement most precisely describes why the second prompt produces more constrained output?`,
    options: [
      `The second prompt is shorter, and shorter prompts always produce better outputs.`,
      `Every token in the second prompt resolves a specific dimension (step count, sequence, component names), leaving the model no unspecified degrees of freedom to confabulate; the first prompt inflates the softmax denominator with modal hedges ("perhaps," "might") and meta-commentary ("I would really appreciate") that carry zero task-constraining information.`,
      `The first prompt is impolite, causing the model to produce lower-quality outputs.`,
      `The developer's version uses imperative mood, which activates a distinct set of attention heads optimised for instruction-following.`,
    ],
    answer: 1,
    explanation:
      `Prompt quality is a function of information density: constraints per token. The first prompt's hedging language and social framing add tokens to the softmax denominator without resolving any design dimension (step count, component structure, flow logic). The second prompt achieves near-total dimension resolution—framework, cardinality, and sequence—leaving almost no pathway for confabulation.`,
  },
  {
    section: 3,
    q: `The dense specification in the presentation uses the separator token "·" which has an information density of 0.00. A critic argues these tokens should be removed to further improve density. The strongest counter-argument based on the tokenisation mechanism is:`,
    options: [
      `Separator tokens trigger a special parsing mode in the model that improves structured output.`,
      `Adjacent technical tokens without separators can merge into out-of-vocabulary compound strings during byte-pair encoding (e.g., "PostgreSQLPrisma"), producing embeddings that don't correspond to either intended token; the structural cost of "·" is near-zero but its tokenisation-disambiguation utility is non-trivial.`,
      `Removing separators would reduce the total token count below the minimum required for positional encoding to work correctly.`,
      `The "·" separator is a special character assigned its own dedicated attention head by the model architecture.`,
    ],
    answer: 1,
    explanation:
      `Tokenisers apply greedy byte-pair merging; two adjacent high-frequency technical strings without whitespace or punctuation may merge into a single unrecognised token. The density score of 0.00 reflects zero semantic resolution, but structural tokens earn their place through tokenisation hygiene—a zero-cost mechanism that prevents embedding corruption.`,
  },
  {
    section: 3,
    q: `A data scientist measures the Shannon entropy of attention weight distributions across prompts with varying filler ratios. She finds that a 33% filler prompt produces H=3.47 bits and a 6% filler prompt produces H=0.30 bits (measured over attention to a target output token). What is the practical engineering consequence of this entropy difference?`,
    options: [
      `High-entropy prompts are preferable because they allow the model to be more creative.`,
      `At H=3.47 bits, the attention distribution is approaching maximum disorder across ~11 positions, meaning the model is drawing nearly equally from 11 competing sources of context; at H=0.30 bits, one source dominates. The high-entropy condition produces inconsistent, run-to-run variable outputs because tiny temperature or sampling differences resolve differently each time.`,
      `Shannon entropy measures compression efficiency, not attention quality; it has no practical consequence for output.`,
      `High entropy indicates a well-calibrated model; low entropy suggests overfitting.`,
    ],
    answer: 1,
    explanation:
      `Shannon entropy H over an attention distribution directly measures how spread the model's "focus" is. H=3.47 bits corresponds to a near-uniform distribution across ~11 positions; the output token is synthesised from 11 roughly equal sources, producing a distribution over outputs with high variance. H=0.30 bits means one context token dominates, constraining the output distribution to a narrow, reproducible peak.`,
  },

  // ── Section 5: Feature Activation Landscape ──────────────────────────────
  {
    section: 4,
    q: `The token "Python" is processed in two contexts: (A) "Python bit the child in the garden" and (B) "Python 3.12 introduced the new type parameter syntax." In a well-trained model, the final-layer feature activations will differ because:`,
    options: [
      `The model maintains a static lookup table mapping each token to a fixed activation vector.`,
      `Transformer contextual embeddings are constructed by attending to and blending surrounding tokens' value vectors; surrounding tokens in (A) (garden, child, bit) reinforce biological-entity features, while (B) tokens (3.12, syntax, type parameter) reinforce programming-language technical features—producing fundamentally different final-layer representations from the same token string.`,
      `The model has two separate vocabularies for Python (snake) and Python (language) that activate different embedding rows.`,
      `Positional encoding disambiguates meaning by assigning different embedding offsets based on sentence position.`,
    ],
    answer: 1,
    explanation:
      `This is the core property of contextual embeddings: a token's representation is not fixed at the embedding layer but is reshaped through every attention layer by the representations of its neighbours. By the final layer, "Python" in a garden context has attended to and integrated biological/action features; "Python" in a syntax context has integrated technical/version features. The same input token produces radically different final representations.`,
  },
  {
    section: 4,
    q: `In the 3D activation landscape, the token "React/Next.js" achieves a technical-feature activation of 0.92 in the final layer, up from 0.60 at the embedding layer. The other features (entity, spatial, temporal) drop below 0.05 by the final layer. Which mechanism is most directly responsible for this sharpening?`,
    options: [
      `The model applies a ReLU gate at each layer that zeros out non-dominant features after a threshold.`,
      `Surrounding tokens ("14", "Stripe", "PostgreSQL", "Tailwind") all activate strongly in the technical-feature dimension; as they attend to each other across layers, their shared technical features are amplified in every token's value vector through weighted blending, while non-shared features (e.g., temporal associations of "14" as a year) receive weak reinforcement and decay.`,
      `The model recognises registered brand names and routes them to a specialised technical embedding.`,
      `Softmax normalisation in later layers mechanically redistributes activation mass away from non-dominant features.`,
    ],
    answer: 1,
    explanation:
      `Feature sharpening is an emergent property of multi-layer self-attention. Tokens that share a feature dimension attend to each other with high weights, and each attends-and-blends amplifies the shared dimension in the updated representation. Non-shared dimensions receive little reinforcement and attenuate. This is not hardcoded routing—it emerges from the attention weight distribution and value vector composition.`,
  },
  {
    section: 4,
    q: `A prompt uses the word "interface" in the sentence "Define the interface between the legacy COBOL batch jobs and the new microservice layer." In the 3D activation landscape, "interface" would most likely show:`,
    options: [
      `A single dominant spike in the social/communication feature dimension (interface as human-facing UI).`,
      `A broad initial activation across UI, social, and technical dimensions at the embedding layer, which sharpens to a dominant technical/architectural spike by the final layer as surrounding tokens (COBOL, batch, microservice, legacy) provide unambiguous technical context.`,
      `Uniform low activation across all dimensions because "interface" is too ambiguous for the model to represent confidently.`,
      `Identical activation in all layers, because polysemous words are resolved at tokenisation time.`,
    ],
    answer: 1,
    explanation:
      `Polysemous words begin with distributed activation across their plausible interpretations. As context tokens are integrated through successive attention layers, the disambiguating signal from "COBOL," "microservice," and "batch jobs" reinforces the software-architecture feature dimension and suppresses UI/social interpretations. The landscape goes from flat and broad to tall and narrow—demonstrating context-driven disambiguation in action.`,
  },

  // ── Section 6: How Landscape Impacts Output ───────────────────────────────
  {
    section: 5,
    q: `An AI-assisted clinical decision tool receives the prompt: "Patient presents with sudden unilateral weakness, facial droop, and slurred speech. What should we consider?" The model's differential diagnosis output correlates at r=0.81 with the frequency of diagnosis labels in its training corpus. What is the most serious engineering implication for clinical deployment?`,
    options: [
      `High training-frequency correlation means the model is well-calibrated to population base rates, which is clinically appropriate.`,
      `The model is generating outputs based on what diagnoses appear most often in training text—not on systematic reasoning from the symptom constellation. Common diagnoses (tension headache, anxiety) will be over-represented while high-acuity diagnoses with this specific triad (ischaemic stroke, TIA) require immediate action and may be ranked lower than statistical frequency warrants.`,
      `The correlation indicates the model has learned from high-quality medical literature, improving reliability.`,
      `r=0.81 is below the threshold for clinical concern; correlations above 0.95 would indicate a problem.`,
    ],
    answer: 1,
    explanation:
      `This symptom triad (sudden unilateral weakness + facial droop + slurred speech) is the classic stroke presentation requiring immediate thrombectomy assessment. A model defaulting to training frequency will surface whichever diagnoses appear most often in text—not necessarily those most probable given this specific combination. Dense, structured prompts (including onset timing, risk factors, vitals) would sharpen the feature landscape and reduce the training-frequency correlation.`,
  },
  {
    section: 5,
    q: `At Top-K=5, a vague prompt produces renormalised probabilities of [28%, 25%, 22%, 14%, 12%] for the five most likely next tokens. A dense spec produces [87%, 6%, 3%, 2%, 2%]. A system architect proposes increasing K to 50 for both prompts to "give the model more vocabulary range." Which prediction is most consistent with the sampling mechanics?`,
    options: [
      `Both prompts become equally variable because the larger K window introduces the same additional candidates.`,
      `For the vague prompt, tokens 6–50 carry non-negligible probability (potentially 3–7% each), substantially widening the output distribution and increasing variance; for the dense spec, tokens 6–50 carry <0.5% each, so K=50 and K=5 produce nearly identical effective distributions—the dense spec's variance is structurally bounded by prompt specificity, not by K.`,
      `Increasing K always reduces variance by spreading probability mass more evenly.`,
      `K has no effect because the model renormalises regardless; only temperature changes output variance.`,
    ],
    answer: 1,
    explanation:
      `Top-K sampling is bounded by the shape of the underlying logit distribution. For a flat distribution (vague prompt), tokens 6–50 still carry meaningful mass; widening the window admits more competitors and increases variance. For a peaked distribution (dense spec), tokens 6–50 are negligible—the window expansion changes little because the probability mass is already concentrated. Prompt density, not K, is the binding constraint.`,
  },
  {
    section: 5,
    q: `In the confabulation pathways analysis, "framework" choice has confabulation risk 0.90 while "authentication" has risk 0.75, even though both dimensions are equally unresolved in the vague prompt. What most plausibly accounts for the different risk ratings?`,
    options: [
      `Framework names appear more frequently in training data than authentication terms, raising confabulation probability.`,
      `Confabulation risk reflects not only whether a token is invented, but how many downstream tokens are causally constrained by it. Framework choice (Shopify vs. React vs. WordPress) determines component structure, API patterns, file layout, and deployment throughout the entire output; authentication choice has fewer cascading dependents—its confabulation corrupts a narrower subtree.`,
      `The model has explicit knowledge that authentication is less important than framework selection.`,
      `Authentication tokens have higher average confidence scores, which the risk metric penalises.`,
    ],
    answer: 1,
    explanation:
      `Confabulation risk is a function of both invention probability and blast radius. An invented framework choice propagates through every subsequent technical decision in the generated code—imports, component names, routing, build tooling—creating a structurally inconsistent output. An invented auth pattern affects a smaller, more isolated subtree. The risk metric encodes causal depth, not just whether the token is confabulated.`,
  },

  // ── Section 7: Hallucination Map ──────────────────────────────────────────
  {
    section: 6,
    q: `A model generates "The patient's creatinine was 2.4 mg/dL, indicating moderate renal impairment." The prompt said only "summarise the patient's lab results." No creatinine value appeared in the source document. Using the grounding taxonomy, how should "2.4" and "moderate" be classified, and which poses greater patient safety risk?`,
    options: [
      `Both are inferred tokens because lab summaries typically include creatinine values.`,
      `"2.4" is confabulated (a specific value invented with logit confidence ~0.20, competing equally with 1.8, 3.1, 2.9, etc.); "moderate" is defaulted (the model's training frequency for creatinine-impairment descriptions skews toward "moderate" as the most common modifier). "2.4" poses greater risk because a specific numeric value falsely signals precision and may be used directly in clinical decision-making.`,
      `"2.4" is grounded because creatinine ranges are common in medical training data; "moderate" is confabulated.`,
      `Both are structural tokens that carry no semantic risk in a medical summarisation context.`,
    ],
    answer: 1,
    explanation:
      `Specific numeric confabulations are more dangerous than vague qualitative defaults precisely because they appear authoritative. A clinician seeing "2.4 mg/dL" may act on it as a real measurement. The logit distribution for this position would show multiple plausible values (1.8, 2.1, 2.4, 3.0, 3.2) with probabilities within 5% of each other—the hallmark of a confabulated token—yet the single sampled value looks indistinguishable from a grounded one.`,
  },
  {
    section: 6,
    q: `After running a dense spec 100 times, "App Router" appears 94 times and "Pages Router" 6 times in the output. Both tokens are classified as "inferred" rather than "confabulated." What is the most precise mechanistic explanation for the 6% minority outcome?`,
    options: [
      `The 6% outputs are confabulations caused by temperature sampling introducing noise.`,
      `Inference is probabilistic: "Next.js 14" strongly entails App Router (the default since v13.4), but does not eliminate Pages Router, which remains available. The 6% reflects the model's uncertainty about which routing paradigm was intended—it is a genuine inference from an ambiguous entailment, not an invented value with no grounding in the prompt.`,
      `The model randomly swaps framework features with 6% probability as a regularisation mechanism.`,
      `Pages Router outputs occur when the sampling temperature exceeds 1.0; at temperature ≤1.0, only App Router is produced.`,
    ],
    answer: 1,
    explanation:
      `The distinction between inferred and confabulated tokens is whether the token is logically entailed by the prompt (even if probabilistically). "Next.js 14" makes App Router the dominant inference but doesn't preclude Pages Router—both are technically valid within the framework. The 6% is a calibration question (the model is slightly under-confident), not a hallucination. A confabulated outcome would have no grounding in the prompt at all.`,
  },
  {
    section: 6,
    q: `The hallucination map shows a confabulated token ("35-55") with a confidence score of 0.20, while another confabulated token ("Shopify") has a score of 0.18. A third token, a structural "and," has a confidence score of 0.90. Why is the 0.90 score on "and" not diagnostically meaningful in the same way that a 0.90 would be on a content token?`,
    options: [
      `Structural tokens are excluded from confidence calculations by the model architecture.`,
      `Grammatical connectives like "and" are almost always the correct next token in their syntactic positions regardless of the semantic content of the generation—their high confidence reflects morphosyntactic determinism, not semantic grounding. A content token scoring 0.90 means the model has a semantically constrained, high-signal reason to choose that specific word; "and" at 0.90 means the grammar left no other option.`,
      `High-confidence structural tokens indicate the model has seen the exact sentence in training data.`,
      `A score of 0.90 is only meaningful above a threshold of 0.95; both types of tokens would be diagnostically relevant at that level.`,
    ],
    answer: 1,
    explanation:
      `Confidence score measures the probability gap between the winner and its nearest competitor. For function words in grammatically constrained positions, the winner probability is high simply because syntax eliminates alternatives—not because the content is grounded. Hallucination risk is a function of both confidence and grounding status; a confident structural token carries near-zero hallucination risk, while a confident content token with weak grounding (if such exists) is the most dangerous failure mode.`,
  },

  // ── Section 8: Confidence Landscape 3D ───────────────────────────────────
  {
    section: 7,
    q: `A researcher sorts the confidence landscape of a radiology report summarisation task "by entropy" and finds the highest-entropy tokens are drug dosages and measurement values, while anatomical direction terms ("left," "bilateral") are low entropy. What is the most precise diagnostic interpretation?`,
    options: [
      `The model does not know medical vocabulary and is guessing on all specialised terms.`,
      `Anatomical direction terms are tightly constrained by surrounding syntax (the report specifies laterality), producing low entropy; specific measurement values (was it 12mm or 14mm? was the dose 25mg or 50mg?) were not constrained by the input prompt, so multiple plausible values compete with near-equal probability—flagging these positions as high under-specification risk rather than model ignorance.`,
      `High-entropy tokens indicate the model is performing well by maintaining calibrated uncertainty.`,
      `Entropy sorting reveals which tokens were seen fewer than 100 times in training data.`,
    ],
    answer: 1,
    explanation:
      `Entropy H over the logit distribution at a position is a direct measure of how constrained that decision was. Anatomical terms are constrained by what the report stated; the model has strong grounding. Measurement values are high entropy because the prompt left the specific numbers unspecified—the model faces a flat distribution over plausible values. This is under-specification risk, not model failure: the remedy is a richer input prompt, not a different model.`,
  },
  {
    section: 7,
    q: `A sorting analysis shows that a token is ranked in the rightmost position (highest confidence) when sorted by confidence, but in the leftmost position (worst grounding) when sorted by grounding status. What does this divergence reveal about the failure mode?`,
    options: [
      `The sorting algorithm has a bug; these two orderings cannot legitimately diverge.`,
      `This is the signature of a confident confabulation: the model has assigned very high probability to an invented token, meaning the runner-up alternatives were not competitive. This is more dangerous than a low-confidence confabulation because the output appears authoritative and the logit distribution provides no detectable uncertainty signal to a downstream consumer.`,
      `High confidence always implies grounding; a grounding score of zero must be a labelling error.`,
      `This pattern occurs when the model has memorised the exact output from training data.`,
    ],
    answer: 1,
    explanation:
      `Confidence and grounding are independent axes. Confidence measures the shape of the logit distribution (peaked vs. flat). Grounding measures whether the output token has causal ancestry in the input. A model that has strongly overfit to a training pattern will produce high-confidence outputs that are hallucinations when that pattern does not apply in the new context. The confidence landscape's dual-sort is specifically designed to surface this failure mode.`,
  },
  {
    section: 7,
    q: `A prompt engineer argues that a dense spec's near-uniform high-confidence landscape means the output "lacks creativity." She proposes re-introducing vague tokens to lower confidence on selected dimensions and enable "creative variance." What does the confidence landscape analysis reveal about this proposal?`,
    options: [
      `The engineer is correct; reducing confidence on creative dimensions is the standard mechanism for generating diverse outputs.`,
      `Lowering confidence by introducing vague tokens does not produce intentional creative variance—it produces confabulation pathways. Genuine creative latitude requires explicitly specifying an open dimension (e.g., "choose one of three distinct visual themes") so the model executes a constrained choice, not an unguided invention. The landscape shows that unspecified dimensions become hallucination sites, not creativity sites.`,
      `Confidence and creativity are orthogonal; the landscape says nothing about creative potential.`,
      `The proposal is valid only if temperature is simultaneously reduced to compensate for the added variance.`,
    ],
    answer: 1,
    explanation:
      `The landscape conflates two different phenomena: intentional creative latitude (explicitly delegated to the model with a defined scope) and accidental vagueness (unspecified dimensions the model must fill). The first produces a constrained choice from a defined space; the second produces confabulation from an unconstrained one. Creativity achieved by introducing vagueness is indistinguishable from confabulation in the landscape—both appear as flat distributions where the winning token has no grounding advantage over its competitors.`,
  },

  // ── Section 9: Language vs. Thought ──────────────────────────────────────
  {
    section: 8,
    q: `An LLM scores 96% on a benchmark requiring grammaticality judgements for complex English constructions (filler-gap dependencies, negative polarity items, subject-verb agreement across intervening clauses). The same model scores 44% on arithmetic word problems where the underlying computation involves only single-digit addition. The formal/functional competence framework predicts this pattern because:`,
    options: [
      `The model was fine-tuned on grammar benchmarks but not on arithmetic, creating a dataset artefact.`,
      `Grammaticality judgement recruits the Language Network, which transformers effectively model through pattern matching over billions of training sentences; even trivially simple arithmetic word problems require the Multiple Demand Network—extracting operands, holding intermediate values, and applying operations—which is a distinct cognitive system that transformers do not implement natively regardless of arithmetic difficulty.`,
      `96% accuracy on grammar indicates a fully general intelligence; the arithmetic failure must reflect a data quality issue.`,
      `Word problems require visual-spatial processing that text-only models lack by design.`,
    ],
    answer: 1,
    explanation:
      `The dissociation is predicted by neuroscience: the Language Network and Multiple Demand Network are physically separate neural circuits that can be damaged independently. LLMs model the Language Network well because training on text optimises for exactly the pattern-matching and distributional statistics that network computes. The Multiple Demand Network's symbolic, step-by-step computation is architecturally absent—not degraded by training data quality.`,
  },
  {
    section: 8,
    q: `A researcher tests an LLM on the Sally-Anne false-belief task and achieves 45% accuracy (near chance). She then rewrites the task to include: "Remember: Sally does NOT know that Anne moved the ball. Sally's belief is that the ball is still in the basket. Given Sally's belief, where will she look?" Accuracy rises to 82%. A cognitive scientist argues this does not demonstrate Theory of Mind. Why is this a valid scientific objection?`,
    options: [
      `The revised prompt is longer, so any improvement is attributable to context length effects.`,
      `The revised prompt surfaces the correct answer ("basket") as explicit surface content adjacent to the question; the model is performing linguistic pattern matching—identifying the correct answer string from nearby text—not modelling a separate agent's mental state. A genuine Theory of Mind test requires that the answer is not cued by surface form; improvement that depends on making the answer explicit is not ToM evidence.`,
      `82% accuracy is below the 95% threshold required to claim cognitive capability.`,
      `The Sally-Anne task is not a valid measure of Theory of Mind even in humans.`,
    ],
    answer: 1,
    explanation:
      `This is a fundamental methodological issue in LLM cognitive evaluation. The Theory of Mind Network's function is to maintain a separate belief-state model for another agent—not to extract an answer from a prompt that spells it out. When the revised prompt explicitly states Sally's belief AND the question follows immediately, the model can "answer" via surface-pattern completion without any genuine belief-state tracking. Valid ToM tests require the correct answer to be computable only from an agent model, not from text adjacency.`,
  },
  {
    section: 8,
    q: `GPT-4 achieves 0.95 on formal language tasks and 0.65 on functional tasks (reasoning, world knowledge, situation modelling, social cognition), up from GPT-2's 0.30. Given the brain-network model presented, which engineering intervention most directly targets the remaining functional gap—and why is simply scaling to a larger model insufficient?`,
    options: [
      `Training on a larger and more diverse text corpus; functional competence emerges from exposure to more reasoning examples.`,
      `Integrating specialised external tools—calculators and code interpreters for the Multiple Demand Network, knowledge graphs for world knowledge, and structured narrative trackers for situation modelling—and routing the language model as an orchestrator that calls these tools. Scaling alone is insufficient because the gap is architectural: the Language Network being modelled by transformers is neurologically separate from the systems these tasks require, and adding parameters to the Language Network cannot substitute for a missing computational system.`,
      `Fine-tuning on domain-specific reasoning datasets for each functional category.`,
      `Increasing the number of attention heads to give the model more representational capacity for multi-step reasoning.`,
    ],
    answer: 1,
    explanation:
      `The GPT-2→GPT-4 trajectory shows functional competence improving but plateauing at 0.65—not converging to human levels despite massive parameter scaling. The brain-network model explains why: the Multiple Demand Network, Default Network, and Theory of Mind Network are distinct computational systems whose capabilities cannot be approximated arbitrarily well by scaling a text-prediction objective. Modular tool use—the architecture of current frontier agents—is the engineering analogue of the brain's modular specialisation.`,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8).toUpperCase();
}

function scoreLabel(pct) {
  if (pct >= 93) return { label: "Distinction", color: C.amber };
  if (pct >= 74) return { label: "Pass", color: C.blue };
  return { label: "Did Not Pass", color: C.red };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Label({ text, color, borderColor }) {
  return (
    <span style={{
      display: "inline-block",
      fontSize: 10,
      fontFamily: C.mono,
      textTransform: "uppercase",
      letterSpacing: 2,
      color,
      border: `1px solid ${borderColor}`,
      borderRadius: 4,
      padding: "2px 8px",
    }}>
      {text}
    </span>
  );
}

function ProgressBar({ value, max, color }) {
  return (
    <div style={{ height: 4, background: "rgba(124,141,176,0.15)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${(value / max) * 100}%`,
        background: color,
        borderRadius: 2,
        transition: "width 0.4s ease",
      }} />
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────

function IntroScreen({ onStart }) {
  const [name, setName] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
      <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontFamily: C.mono, color: C.amber, textTransform: "uppercase", letterSpacing: 3, marginBottom: 16 }}>
          Comprehension Assessment
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 700, color: "#E2E8F0", fontFamily: C.sans, margin: "0 0 12px", lineHeight: 1.2 }}>
          Engineering Professional<br />Certification Exam
        </h1>
        <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, fontFamily: C.sans, margin: "0 0 40px" }}>
          27 questions across 9 sections. Each question requires applying the
          mechanisms covered in this presentation to novel scenarios—not
          recalling slide text. Pass threshold is <strong style={{ color: C.text }}>20&nbsp;/ 27</strong>.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 40, textAlign: "left" }}>
          {[
            { n: "9", label: "Sections" },
            { n: "27", label: "Questions" },
            { n: "≥74%", label: "Pass threshold" },
          ].map(({ n, label }) => (
            <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.amber, fontFamily: C.mono }}>{n}</div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: C.sans, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 32, textAlign: "left" }}>
          <label style={{ fontSize: 12, fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: 1.5, display: "block", marginBottom: 8 }}>
            Your name (for the certificate)
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter your full name"
            onKeyDown={e => e.key === "Enter" && name.trim() && onStart(name.trim())}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: C.surface,
              border: `1px solid ${name.trim() ? C.amberBorder : C.border}`,
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 16,
              color: C.text,
              fontFamily: C.sans,
              outline: "none",
              transition: "border-color 0.2s",
            }}
          />
        </div>

        <button
          onClick={() => onStart(name.trim())}
          disabled={!name.trim()}
          style={{
            width: "100%",
            padding: "14px 32px",
            borderRadius: 8,
            border: `1px solid ${C.amberBorder}`,
            background: name.trim() ? "rgba(232,168,56,0.18)" : "rgba(124,141,176,0.05)",
            color: name.trim() ? C.amber : C.dim,
            fontSize: 15,
            fontWeight: 600,
            fontFamily: C.sans,
            cursor: name.trim() ? "pointer" : "not-allowed",
            letterSpacing: 0.5,
            transition: "all 0.2s",
          }}
        >
          Begin Assessment →
        </button>

        <p style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginTop: 16 }}>
          Navigation is disabled during the assessment. You cannot go back.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ section, sectionIndex, onContinue }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 24px" }}>
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>{section.icon}</div>
        <Label text={`Section ${sectionIndex + 1} of ${SECTIONS.length}`} color={C.amber} borderColor={C.amberBorder} />
        <h2 style={{ fontSize: 32, fontWeight: 700, color: "#E2E8F0", fontFamily: C.sans, margin: "16px 0 8px", lineHeight: 1.3 }}>
          {section.title}
        </h2>
        <p style={{ fontSize: 14, color: C.muted, fontFamily: C.sans, marginBottom: 40 }}>
          {section.subtitle}
        </p>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 20px", marginBottom: 40, textAlign: "left" }}>
          <div style={{ fontSize: 11, color: C.dim, fontFamily: C.mono, marginBottom: 6 }}>3 questions in this section</div>
          <ProgressBar value={sectionIndex} max={SECTIONS.length} color={C.amber} />
        </div>
        <button
          onClick={onContinue}
          style={{
            padding: "12px 40px",
            borderRadius: 8,
            border: `1px solid ${C.amberBorder}`,
            background: "rgba(232,168,56,0.15)",
            color: C.amber,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: C.sans,
            cursor: "pointer",
          }}
        >
          Start Section →
        </button>
      </div>
    </div>
  );
}

function QuestionScreen({ question, questionNumber, totalQuestions, sectionIndex, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const correct = selected === question.answer;

  const handleSelect = (i) => {
    if (revealed) return;
    setSelected(i);
  };

  const handleReveal = () => {
    if (selected === null) return;
    setRevealed(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 24px 100px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <Label text={SECTIONS[sectionIndex].title} color={C.blue} borderColor={C.blueBorder} />
          <span style={{ fontSize: 12, fontFamily: C.mono, color: C.dim }}>
            Q{questionNumber} / {totalQuestions}
          </span>
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 32 }}>
          <ProgressBar value={questionNumber - 1} max={totalQuestions} color={C.blue} />
        </div>

        {/* Question */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 16, color: C.text, lineHeight: 1.75, fontFamily: C.sans, margin: 0 }}>
            {question.q}
          </p>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {question.options.map((opt, i) => {
            let borderColor = C.border;
            let bg = C.surface;
            let color = C.text;
            let indicator = null;

            if (revealed) {
              if (i === question.answer) {
                borderColor = C.greenBorder;
                bg = C.greenDim;
                color = C.green;
                indicator = "✓";
              } else if (i === selected && i !== question.answer) {
                borderColor = C.redBorder;
                bg = C.redDim;
                color = C.red;
                indicator = "✗";
              } else {
                color = C.dim;
              }
            } else if (i === selected) {
              borderColor = C.amberBorder;
              bg = C.amberDim;
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  background: bg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  textAlign: "left",
                  cursor: revealed ? "default" : "pointer",
                  transition: "all 0.15s",
                  width: "100%",
                }}
              >
                <span style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: `1px solid ${revealed && i === question.answer ? C.green : revealed && i === selected ? C.red : i === selected ? C.amber : C.border}`,
                  background: revealed && i === question.answer ? C.greenDim : revealed && i === selected && i !== question.answer ? C.redDim : i === selected ? C.amberDim : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: revealed && i === question.answer ? C.green : revealed && i === selected ? C.red : C.amber,
                  fontFamily: C.mono,
                  marginTop: 1,
                }}>
                  {indicator || String.fromCharCode(65 + i)}
                </span>
                <span style={{ fontSize: 14, color, lineHeight: 1.65, fontFamily: C.sans }}>
                  {opt}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {revealed && (
          <div style={{
            background: correct ? C.greenDim : C.redDim,
            border: `1px solid ${correct ? C.greenBorder : C.redBorder}`,
            borderRadius: 10,
            padding: "18px 22px",
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, fontFamily: C.mono, color: correct ? C.green : C.red, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
              {correct ? "Correct" : "Incorrect"} — Explanation
            </div>
            <p style={{ fontSize: 14, color: C.text, lineHeight: 1.75, fontFamily: C.sans, margin: 0 }}>
              {question.explanation}
            </p>
          </div>
        )}

        {/* Action button */}
        {!revealed ? (
          <button
            onClick={handleReveal}
            disabled={selected === null}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 8,
              border: `1px solid ${selected !== null ? C.amberBorder : C.border}`,
              background: selected !== null ? "rgba(232,168,56,0.15)" : "transparent",
              color: selected !== null ? C.amber : C.dim,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: C.sans,
              cursor: selected !== null ? "pointer" : "not-allowed",
            }}
          >
            Reveal Answer
          </button>
        ) : (
          <button
            onClick={() => onAnswer(selected === question.answer)}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 8,
              border: `1px solid ${C.amberBorder}`,
              background: "rgba(232,168,56,0.15)",
              color: C.amber,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: C.sans,
              cursor: "pointer",
            }}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

async function downloadCertPDF({ title, subtitle, name, body, fields, watermark = "LLM ENGINEERING COURSE" }) {
  // Load jsPDF from CDN
  if (!window.jspdf) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210;

  // Background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, H, "F");

  // Watermark (diagonal, repeated)
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  for (let y = -50; y < H + 50; y += 40) {
    for (let x = -100; x < W + 100; x += 160) {
      doc.text(watermark, x, y, { angle: 30 });
    }
  }

  // Border
  doc.setDrawColor(232, 168, 56);
  doc.setLineWidth(0.5);
  doc.rect(12, 12, W - 24, H - 24);
  doc.rect(15, 15, W - 30, H - 30);

  // Corner ornaments
  const cLen = 8;
  [[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]].forEach(([x, y, dx, dy]) => {
    doc.line(x, y, x + cLen * dx, y);
    doc.line(x, y, x, y + cLen * dy);
  });

  // Title
  doc.setTextColor(232, 168, 56);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), W / 2, 38, { align: "center" });

  // Subtitle
  doc.setTextColor(138, 150, 167);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle.toUpperCase(), W / 2, 45, { align: "center" });

  // "This certifies that"
  doc.setTextColor(138, 150, 167);
  doc.setFontSize(10);
  doc.text("This certifies that", W / 2, 60, { align: "center" });

  // Name
  doc.setTextColor(226, 232, 240);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(name, W / 2, 75, { align: "center" });

  // Divider
  doc.setDrawColor(232, 168, 56);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 20, 82, W / 2 + 20, 82);

  // Body text
  doc.setTextColor(138, 150, 167);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const bodyLines = doc.splitTextToSize(body, 180);
  doc.text(bodyLines, W / 2, 92, { align: "center", lineHeightFactor: 1.6 });

  // Fields row
  const fieldY = 135;
  const fieldSpacing = W / (fields.length + 1);
  fields.forEach((f, i) => {
    const x = fieldSpacing * (i + 1);
    doc.setTextColor(74, 85, 104);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(f.label.toUpperCase(), x, fieldY, { align: "center" });
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(f.value, x, fieldY + 7, { align: "center" });
  });

  // Footer
  doc.setTextColor(50, 60, 80);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("This certificate was generated as part of the LLM Engineering Course", W / 2, H - 20, { align: "center" });

  doc.save(`${name.replace(/\s+/g, "_")}_Certificate.pdf`);
}

function Certificate({ name, score, total, sectionScores, onRetry }) {
  const pct = Math.round((score / total) * 100);
  const { label, color } = scoreLabel(pct);
  const passed = pct >= 74;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const certId = hashCode(`${name}${date}${score}`);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 24px 100px" }} id="certificate-root">
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Result banner */}
        <div style={{
          textAlign: "center",
          marginBottom: 36,
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{passed ? "✦" : "◇"}</div>
          <Label text={label} color={color} borderColor={color + "55"} />
          <p style={{ fontSize: 15, color: C.muted, fontFamily: C.sans, marginTop: 12 }}>
            {passed
              ? "You have demonstrated engineering-level comprehension of transformer architecture and LLM mechanics."
              : `You scored ${pct}% — pass threshold is 74%. Review the sections below and try again.`}
          </p>
        </div>

        {/* Certificate card */}
        <div style={{
          background: "linear-gradient(135deg, #0F1927 0%, #111E30 100%)",
          border: `1px solid ${passed ? C.amberBorder : C.border}`,
          borderRadius: 16,
          padding: "48px 52px",
          textAlign: "center",
          position: "relative",
          marginBottom: 32,
          boxShadow: passed ? `0 0 60px rgba(232,168,56,0.06)` : "none",
        }}>
          {/* Corner ornaments */}
          {["top-left", "top-right", "bottom-left", "bottom-right"].map(pos => (
            <div key={pos} style={{
              position: "absolute",
              [pos.includes("top") ? "top" : "bottom"]: 16,
              [pos.includes("left") ? "left" : "right"]: 16,
              width: 20, height: 20,
              borderTop: pos.includes("top") ? `2px solid ${passed ? C.amberBorder : C.border}` : "none",
              borderBottom: pos.includes("bottom") ? `2px solid ${passed ? C.amberBorder : C.border}` : "none",
              borderLeft: pos.includes("left") ? `2px solid ${passed ? C.amberBorder : C.border}` : "none",
              borderRight: pos.includes("right") ? `2px solid ${passed ? C.amberBorder : C.border}` : "none",
            }} />
          ))}

          <div style={{ fontSize: 11, fontFamily: C.mono, color: passed ? C.amber : C.muted, textTransform: "uppercase", letterSpacing: 4, marginBottom: 8 }}>
            Certificate of Comprehension
          </div>
          <div style={{ fontSize: 11, fontFamily: C.mono, color: C.dim, textTransform: "uppercase", letterSpacing: 3, marginBottom: 32 }}>
            Engineering Professional Level
          </div>

          <div style={{ fontSize: 13, color: C.muted, fontFamily: C.sans, marginBottom: 8 }}>This certifies that</div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#E2E8F0", fontFamily: C.sans, margin: "0 0 24px", letterSpacing: 0.5 }}>
            {name}
          </div>

          <div style={{
            width: 60, height: 1,
            background: `linear-gradient(90deg, transparent, ${passed ? C.amber : C.muted}, transparent)`,
            margin: "0 auto 24px",
          }} />

          <div style={{ fontSize: 13, color: C.muted, fontFamily: C.sans, lineHeight: 1.9, maxWidth: 480, margin: "0 auto 32px" }}>
            has demonstrated engineering-level comprehension of<br />
            transformer self-attention mechanisms, weight formation dynamics,<br />
            feature activation landscapes, hallucination topology,<br />
            and the formal–functional competence distinction in<br />
            large language models.
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
            {[
              { label: "Score", value: `${score} / ${total}` },
              { label: "Percentage", value: `${pct}%` },
              { label: "Result", value: label },
              { label: "Date", value: date },
              { label: "Certificate ID", value: certId },
            ].map(({ label: l, value: v }) => (
              <div key={l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontFamily: C.mono, color: C.dim, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 14, fontFamily: l === "Certificate ID" ? C.mono : C.sans, color: l === "Result" ? color : C.text, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section breakdown */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: "24px 28px",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontFamily: C.mono, color: C.muted, textTransform: "uppercase", letterSpacing: 2, marginBottom: 20 }}>
            Section Breakdown
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {SECTIONS.map((sec, i) => {
              const s = sectionScores[i];
              const secPct = Math.round((s / 3) * 100);
              const secColor = secPct === 100 ? C.green : secPct >= 67 ? C.blue : secPct >= 33 ? C.amber : C.red;
              return (
                <div key={sec.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 14, color: C.muted }}>{sec.icon}</span>
                      <span style={{ fontSize: 13, color: C.text, fontFamily: C.sans }}>{sec.title}</span>
                    </div>
                    <span style={{ fontSize: 12, fontFamily: C.mono, color: secColor }}>{s}/3</span>
                  </div>
                  <ProgressBar value={s} max={3} color={secColor} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => downloadCertPDF({
              title: "Certificate of Comprehension",
              subtitle: "Engineering Professional Level",
              name,
              body: "has demonstrated engineering-level comprehension of transformer self-attention mechanisms, weight formation dynamics, feature activation landscapes, hallucination topology, and the formal\u2013functional competence distinction in large language models.",
              fields: [
                { label: "Score", value: `${score} / ${total}` },
                { label: "Percentage", value: `${pct}%` },
                { label: "Result", value: label },
                { label: "Date", value: date },
                { label: "Certificate ID", value: certId },
              ],
            })}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.muted,
              fontSize: 13,
              fontFamily: C.sans,
              cursor: "pointer",
            }}
          >
            Download PDF
          </button>
          <button
            onClick={onRetry}
            style={{
              flex: 2,
              padding: "12px",
              borderRadius: 8,
              border: `1px solid ${C.amberBorder}`,
              background: "rgba(232,168,56,0.12)",
              color: C.amber,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: C.sans,
              cursor: "pointer",
            }}
          >
            {passed ? "Retake Assessment" : "Try Again"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main State Machine ───────────────────────────────────────────────────────
//
// phase: "intro" | "section-header" | "question" | "done"
// step: index into a flat sequence:
//   [ section-header-0, q0, q1, q2,
//     section-header-1, q3, q4, q5, … ]

export default function EngineeringProfQuiz() {
  const [phase, setPhase] = useState("intro");
  const [name, setName] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState([]); // [true/false, …]

  // Build the flat sequence once, shuffling option order per question
  const sequence = useMemo(() => {
    const seq = [];
    for (let s = 0; s < SECTIONS.length; s++) {
      seq.push({ type: "section-header", sectionIndex: s });
      const qs = QUESTIONS.filter(q => q.section === s);
      qs.forEach(q => {
        // Shuffle options while tracking the correct answer
        const indices = q.options.map((_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const shuffledOptions = indices.map(i => q.options[i]);
        const shuffledAnswer = indices.indexOf(q.answer);
        seq.push({
          type: "question",
          question: { ...q, options: shuffledOptions, answer: shuffledAnswer },
          sectionIndex: s,
        });
      });
    }
    return seq;
  }, []);

  const currentStep = sequence[stepIndex];

  const handleStart = useCallback((n) => {
    setName(n);
    setPhase("sequence");
    setStepIndex(0);
    setAnswers([]);
  }, []);

  const handleSectionContinue = useCallback(() => {
    setStepIndex(i => i + 1);
  }, []);

  const handleAnswer = useCallback((correct) => {
    setAnswers(a => [...a, correct]);
    if (stepIndex + 1 >= sequence.length) {
      setPhase("done");
    } else {
      setStepIndex(i => i + 1);
    }
  }, [stepIndex, sequence.length]);

  const handleRetry = useCallback(() => {
    setPhase("intro");
    setName("");
    setStepIndex(0);
    setAnswers([]);
  }, []);

  // Scoring
  const score = answers.filter(Boolean).length;
  const sectionScores = useMemo(() => {
    const scores = Array(SECTIONS.length).fill(0);
    let qIdx = 0;
    for (let s = 0; s < SECTIONS.length; s++) {
      for (let q = 0; q < 3; q++) {
        if (answers[qIdx]) scores[s]++;
        qIdx++;
      }
    }
    return scores;
  }, [answers]);

  // Question number (across all questions, not including section headers)
  const questionNumber = useMemo(() => {
    if (!currentStep || currentStep.type !== "question") return 0;
    return sequence.slice(0, stepIndex).filter(s => s.type === "question").length + 1;
  }, [currentStep, stepIndex, sequence]);

  if (phase === "intro") {
    return <IntroScreen onStart={handleStart} />;
  }

  if (phase === "done") {
    return (
      <Certificate
        name={name}
        score={score}
        total={QUESTIONS.length}
        sectionScores={sectionScores}
        onRetry={handleRetry}
      />
    );
  }

  // sequence phase
  if (currentStep.type === "section-header") {
    return (
      <SectionHeader
        section={SECTIONS[currentStep.sectionIndex]}
        sectionIndex={currentStep.sectionIndex}
        onContinue={handleSectionContinue}
      />
    );
  }

  return (
    <QuestionScreen
      key={stepIndex}
      question={currentStep.question}
      questionNumber={questionNumber}
      totalQuestions={QUESTIONS.length}
      sectionIndex={currentStep.sectionIndex}
      onAnswer={handleAnswer}
    />
  );
}
