import { useEffect, useState } from 'react'
import { fetchAllSources } from '@/api/caseSubmissions'
import { buildInvestigationModel } from '@/lib/timelineBuilder'
import type { InvestigationModel, SourceLoadError } from '@/types/domain'

export type CaseDataStatus = 'loading' | 'success' | 'error'

interface CaseDataState {
  status: CaseDataStatus
  model: InvestigationModel | null
  error: string | null
  sourceErrors: SourceLoadError[]
}

const INITIAL_STATE: CaseDataState = {
  status: 'loading',
  model: null,
  error: null,
  sourceErrors: [],
}

interface UseCaseDataResult extends CaseDataState {
  reload: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unable to fetch the investigation records.'
}

export function useCaseData(): UseCaseDataResult {
  const [state, setState] = useState<CaseDataState>(INITIAL_STATE)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    fetchAllSources(controller.signal)
      .then(({ sources, errors }) => {
        if (cancelled) return
        const model = buildInvestigationModel(sources, errors)
        if (model.records.length === 0 && errors.length > 0) {
          setState({
            status: 'error',
            model: null,
            error: 'Every source request failed. Retry after the API quota window resets.',
            sourceErrors: errors,
          })
          return
        }
        setState({ status: 'success', model, error: null, sourceErrors: errors })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({
          status: 'error',
          model: null,
          error: getErrorMessage(error),
          sourceErrors: [],
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reloadToken])

  return {
    ...state,
    reload: () => {
      setState(INITIAL_STATE)
      setReloadToken((token) => token + 1)
    },
  }
}
