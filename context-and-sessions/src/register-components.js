// This file is imported once (by main.jsx via App). As each interactive component
// is built, import it here and add it to registerComponent.
import { registerComponent } from './component-registry.js'
import AttentionBudgetAllocator from './components/AttentionBudgetAllocator.jsx'
import BestPracticesPlaybook from './components/BestPracticesPlaybook.jsx'
import ContextAnatomyBars3D from './components/ContextAnatomyBars3D.jsx'
import ContextSessionsAssessment from './components/ContextSessionsAssessment.jsx'
import ContextWindowPlayground from './components/ContextWindowPlayground.jsx'
import DecomposeWavePlan3D from './components/DecomposeWavePlan3D.jsx'
import LeverComparisonTool from './components/LeverComparisonTool.jsx'
import LostInTheMiddleCurve from './components/LostInTheMiddleCurve.jsx'
import MonolithicVsDecomposed from './components/MonolithicVsDecomposed.jsx'
import TurnStackTowers3D from './components/TurnStackTowers3D.jsx'

registerComponent('AttentionBudgetAllocator', AttentionBudgetAllocator)
registerComponent('BestPracticesPlaybook', BestPracticesPlaybook)
registerComponent('ContextAnatomyBars3D', ContextAnatomyBars3D)
registerComponent('ContextSessionsAssessment', ContextSessionsAssessment)
registerComponent('ContextWindowPlayground', ContextWindowPlayground)
registerComponent('DecomposeWavePlan3D', DecomposeWavePlan3D)
registerComponent('LeverComparisonTool', LeverComparisonTool)
registerComponent('LostInTheMiddleCurve', LostInTheMiddleCurve)
registerComponent('MonolithicVsDecomposed', MonolithicVsDecomposed)
registerComponent('TurnStackTowers3D', TurnStackTowers3D)
