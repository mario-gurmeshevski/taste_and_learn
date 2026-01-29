import { Component, type ErrorInfo, type ReactNode } from "react";
import { FaExclamationTriangle, FaSync } from "react-icons/fa";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console in development
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an error:", error);
      console.error("Error Info:", errorInfo);
    }

    // Log error details to state for display
    this.setState({
      error,
      errorInfo,
    });

    // TODO: Send error to error reporting service (e.g., Sentry, LogRocket)
    // logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-red-900/90 border border-red-600 text-red-100 p-6 sm:p-8 rounded-lg max-w-2xl w-full">
            <div className="flex items-center gap-3 mb-4">
              <FaExclamationTriangle
                className="text-red-400 text-2xl sm:text-3xl"
                aria-hidden="true"
              />
              <h1 className="text-xl sm:text-2xl font-bold text-red-100">
                Something went wrong
              </h1>
            </div>

            <p className="text-red-200 mb-6 text-sm sm:text-base">
              We apologize for the inconvenience. An unexpected error
              has occurred. Please try refreshing the page.
            </p>

            <div className="bg-red-950/50 p-4 rounded mb-6">
              <p className="text-red-300 font-mono text-xs sm:text-sm wrap-break-word">
                {this.state.error?.toString()}
              </p>
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-red-300 hover:text-red-100 text-sm font-medium mb-2">
                    Error Stack Trace
                  </summary>
                  <pre className="text-red-400 text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded transition-colors font-medium text-sm sm:text-base"
                aria-label="Try again"
              >
                <FaSync aria-hidden="true" /> Try Again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded transition-colors font-medium text-sm sm:text-base"
                aria-label="Go to home page"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
