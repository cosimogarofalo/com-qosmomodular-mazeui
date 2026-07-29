<script setup lang="ts">
import { computed } from 'vue'

import { proposalCompatibilityIssues, proposalToChainDraft } from '@/services/mazeAiProposal'
import { useChainStore } from '@/stores/chain'
import { useMazeAiStore } from '@/stores/mazeAi'
import { useMazeStore } from '@/stores/maze'
import type { MazeAiContentHint, MazeAiSemanticEdit } from '@/types/mazeAi'

const uiVersion = __MAZE_UI_VERSION__
const maze = useMazeStore()
const chain = useChainStore()
const mazeAi = useMazeAiStore()

const selectedInput = computed(() =>
  maze.audioInputs.find((input) => input.id === chain.draft.inputId),
)
const contentHints = computed<MazeAiContentHint[]>(
  () => mazeAi.capabilities?.contentHints ?? ['AUTO', 'SPEECH', 'MUSIC', 'MIXED', 'UNKNOWN'],
)
const semanticEdits = computed<MazeAiSemanticEdit[]>(
  () => mazeAi.capabilities?.semanticEditModes ?? ['KEEP', 'ATTENUATE', 'REMOVE'],
)
const proposalIssues = computed(() => {
  if (!mazeAi.result || !selectedInput.value) return []
  return proposalCompatibilityIssues(
    mazeAi.result,
    maze.processors,
    selectedInput.value,
    mazeAi.capabilities?.processorCatalogFingerprint,
    mazeAi.health?.version,
  )
})
const generationBlocker = computed(() => {
  if (maze.status !== 'connected') return 'Maze REST non è connesso.'
  if (!mazeAi.generationReady) {
    return mazeAi.compatibility[0] ?? 'MazeAI REST non è pronto.'
  }
  if (!selectedInput.value) return 'Seleziona prima un input gestito da Maze.'
  if (!mazeAi.goal.trim()) return 'Descrivi il risultato desiderato.'
  return ''
})
const canGenerate = computed(
  () => !generationBlocker.value && !mazeAi.isActive && !mazeAi.submitting,
)
const canAccept = computed(
  () =>
    Boolean(mazeAi.result?.proposal) &&
    proposalIssues.value.length === 0 &&
    !mazeAi.proposalAccepted,
)
const progress = computed(() =>
  Math.min(100, Math.max(0, mazeAi.job?.progressPercent ?? 0)),
)
const analysisRegions = computed(() =>
  (mazeAi.result?.analysis.regional ?? []).flatMap((analysis) =>
    analysis.regions.map((region) => ({ ...region, analyzer: analysis.analyzer })),
  ),
)

async function reconnect() {
  await mazeAi.connect(uiVersion, maze.health?.version)
}

async function generate() {
  if (!selectedInput.value || !canGenerate.value) return
  await mazeAi.generate(selectedInput.value.id)
}

function acceptProposal() {
  if (!mazeAi.result || !canAccept.value) return
  const draft = proposalToChainDraft(mazeAi.result, chain.draft, maze.processors)
  chain.replaceDraft(draft)
  mazeAi.markAccepted(chain.revision)
}

function confidence(value: number | undefined) {
  return value === undefined ? '—' : `${Math.round(value * 100)}%`
}
</script>

<template>
  <section class="mazeai-panel">
    <header class="mazeai-header">
      <div>
        <p class="mazeai-eyebrow">Assistente advisory</p>
        <h2>Genera una proposta con MazeAI</h2>
        <p>
          MazeAI analizza l’input e suggerisce una chain. Maze resta l’unica autorità per
          validazione e rendering.
        </p>
      </div>
      <div class="mazeai-connection">
        <span class="mazeai-gate" :class="`is-${mazeAi.status}`">
          {{ mazeAi.status }}
        </span>
        <button
          type="button"
          class="button button-ghost"
          :disabled="mazeAi.status === 'connecting'"
          @click="reconnect"
        >
          Riconnetti
        </button>
      </div>
    </header>

    <div class="mazeai-version-strip">
      <span>UI {{ uiVersion }}</span>
      <span>Maze {{ maze.health?.version ?? '—' }}</span>
      <span>MazeAI {{ mazeAi.health?.version ?? '—' }}</span>
      <span>Schema {{ mazeAi.health?.schemaVersion ?? '—' }}</span>
    </div>

    <div v-if="mazeAi.compatibility.length" class="mazeai-alert is-error">
      <strong>Gate di compatibilità non superato</strong>
      <ul>
        <li v-for="issue in mazeAi.compatibility" :key="issue">{{ issue }}</li>
      </ul>
    </div>

    <div class="mazeai-composer">
      <label class="mazeai-goal">
        <span>Obiettivo</span>
        <textarea
          v-model="mazeAi.goal"
          rows="3"
          placeholder="Esempio: rendi la voce più chiara, rimuovi le false partenze e bilancia il tono."
          :disabled="mazeAi.isActive || mazeAi.submitting"
        />
      </label>

      <div class="mazeai-options">
        <label>
          <span>Contenuto</span>
          <select
            v-model="mazeAi.contentHint"
            :disabled="mazeAi.isActive || mazeAi.submitting"
          >
            <option v-for="hint in contentHints" :key="hint" :value="hint">{{ hint }}</option>
          </select>
        </label>
        <label>
          <span>Intento</span>
          <select
            v-model="mazeAi.semanticEdit"
            :disabled="mazeAi.isActive || mazeAi.submitting"
          >
            <option v-for="edit in semanticEdits" :key="edit" :value="edit">
              {{ edit }}
            </option>
          </select>
        </label>
      </div>

      <div class="mazeai-source-line">
        <span>Input</span>
        <strong>{{ selectedInput?.fileName ?? 'Nessun input selezionato' }}</strong>
        <small v-if="selectedInput">
          {{ selectedInput.sampleRate }} Hz · {{ selectedInput.channels }} ch ·
          {{ selectedInput.totalFrames }} frame
        </small>
      </div>

      <div class="mazeai-actions">
        <button
          type="button"
          class="button button-primary mazeai-generate-button"
          :disabled="!canGenerate"
          :title="generationBlocker"
          @click="generate"
        >
          {{ mazeAi.submitting ? 'Invio…' : 'Genera proposta' }}
        </button>
        <button
          v-if="mazeAi.isActive"
          type="button"
          class="button button-danger"
          @click="mazeAi.cancel"
        >
          Annulla
        </button>
        <button
          v-if="mazeAi.job || mazeAi.result || mazeAi.error"
          type="button"
          class="button button-ghost"
          :disabled="mazeAi.isActive"
          @click="mazeAi.clearResult"
        >
          Pulisci
        </button>
        <span v-if="generationBlocker" class="mazeai-blocker">{{ generationBlocker }}</span>
      </div>
    </div>

    <div v-if="mazeAi.job" class="mazeai-job">
      <div class="mazeai-job-line">
        <strong>{{ mazeAi.job.state }}</strong>
        <span>{{ mazeAi.job.phase ?? mazeAi.job.message ?? 'In elaborazione' }}</span>
        <span>{{ Math.round(progress) }}%</span>
      </div>
      <div class="mazeai-progress"><span :style="{ width: `${progress}%` }" /></div>
    </div>

    <div v-if="mazeAi.error" class="mazeai-alert is-error">
      <strong>MazeAI</strong>
      <span>{{ mazeAi.error }}</span>
    </div>

    <div v-if="mazeAi.result" class="mazeai-result-grid">
      <article class="mazeai-result-card">
        <header>
          <span class="mazeai-card-index">01</span>
          <div>
            <h3>Analisi</h3>
            <p>Evidenze lette da MazeAI, senza modificare la chain.</p>
          </div>
        </header>
        <dl class="mazeai-analysis-list">
          <div>
            <dt>Classificazione</dt>
            <dd>
              {{ mazeAi.result.analysis.contentClassification.type }} ·
              {{ confidence(mazeAi.result.analysis.contentClassification.confidence) }}
            </dd>
          </div>
          <div>
            <dt>Timeline</dt>
            <dd>
              {{
                mazeAi.result.analysis.regional.length > 0
                  ? 'disponibile'
                  : 'non disponibile'
              }}
            </dd>
          </div>
          <div>
            <dt>Evidenze globali</dt>
            <dd>{{ mazeAi.result.analysis.global.length }}</dd>
          </div>
          <div>
            <dt>Regioni</dt>
            <dd>{{ analysisRegions.length }}</dd>
          </div>
        </dl>
        <ul v-if="analysisRegions.length" class="mazeai-region-list">
          <li
            v-for="region in analysisRegions.slice(0, 6)"
            :key="`${region.analyzer}-${region.label}-${region.startFrame}-${region.endFrame}`"
          >
            <strong>{{ region.label }}</strong>
            <span>[{{ region.startFrame }}, {{ region.endFrame }})</span>
            <small>{{ region.analyzer }}</small>
          </li>
        </ul>
      </article>

      <article class="mazeai-result-card">
        <header>
          <span class="mazeai-card-index">02</span>
          <div>
            <h3>Avvisi e log</h3>
            <p>Messaggi diagnostici separati dalla proposta.</p>
          </div>
        </header>
        <ul v-if="mazeAi.result.warnings.length" class="mazeai-warning-list">
          <li
            v-for="warning in mazeAi.result.warnings"
            :key="warning"
          >
            <span>{{ warning }}</span>
          </li>
        </ul>
        <p v-else class="mazeai-empty-copy">Nessun avviso.</p>
        <details v-if="mazeAi.logs.length">
          <summary>{{ mazeAi.logs.length }} eventi log</summary>
          <ol class="mazeai-log-list">
            <li v-for="(entry, index) in mazeAi.logs" :key="`${index}-${entry}`">
              {{ entry }}
            </li>
          </ol>
        </details>
      </article>

      <article class="mazeai-result-card is-proposal">
        <header>
          <span class="mazeai-card-index">03</span>
          <div>
            <h3>Chain suggerita</h3>
            <p>Anteprima in sola lettura, ancora separata dal draft.</p>
          </div>
        </header>

        <div v-if="mazeAi.result.proposal" class="mazeai-proposal">
          <div
            v-for="(effect, index) in mazeAi.result.proposal.effects"
            :key="`${effect.processorId}-${index}`"
            class="mazeai-proposal-effect"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <strong>{{ maze.processorById(effect.processorId)?.name ?? effect.processorId }}</strong>
              <code>{{ effect.processorId }}</code>
              <small v-if="effect.rationale">{{ effect.rationale }}</small>
            </div>
            <div class="mazeai-effect-counts">
              <span>{{ effect.params.length }} parametri</span>
              <span>
                {{
                  effect.params.reduce(
                    (count, parameter) => count + parameter.regions.length,
                    0,
                  )
                }}
                regioni
              </span>
            </div>
          </div>

          <div v-if="proposalIssues.length" class="mazeai-alert is-error">
            <strong>La proposta non può essere accettata</strong>
            <ul>
              <li v-for="issue in proposalIssues" :key="issue">{{ issue }}</li>
            </ul>
          </div>

          <div v-if="mazeAi.proposalAccepted" class="mazeai-alert is-success">
            <strong>Proposta copiata nel draft</strong>
            <span>La chain resta modificabile. Usa “Validate” per inviarla a Maze.</span>
          </div>

          <button
            type="button"
            class="button button-primary mazeai-accept-button"
            :disabled="!canAccept"
            @click="acceptProposal"
          >
            Accetta proposta
          </button>
        </div>
        <p v-else class="mazeai-empty-copy">MazeAI non ha prodotto una chain.</p>
      </article>
    </div>

    <div v-else-if="!mazeAi.job && !mazeAi.error" class="mazeai-empty-state">
      <span>AI</span>
      <div>
        <strong>Nessuna proposta generata</strong>
        <p>Il draft corrente non verrà toccato fino all’accettazione esplicita.</p>
      </div>
    </div>
  </section>
</template>
