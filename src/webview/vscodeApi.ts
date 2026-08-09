declare const acquireVsCodeApi: () => {
  postMessage: (message: unknown) => void
  getState: () => unknown
  setState: (state: unknown) => void
}

declare global {
  interface Window {
    __BOARD_PATH__?: string
  }
}

export const vscode = acquireVsCodeApi()

if (window.__BOARD_PATH__) {
  vscode.setState({ boardPath: window.__BOARD_PATH__ })
}
