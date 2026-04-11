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
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎓</div>
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
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
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

  // Watermark (tiled logo, very light)
  var wmImg = "data:image/png;base64,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";
  var wmW = 40, wmH = 25;
  doc.saveGraphicsState();
  doc.setGState(new doc.GState({opacity: 0.06}));
  for (var wy = 5; wy < H; wy += 35) {
    for (var wx = 5; wx < W; wx += 55) {
      doc.addImage(wmImg, "PNG", wx, wy, wmW, wmH);
    }
  }
  doc.restoreGraphicsState();

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
