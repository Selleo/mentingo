import { Navigate } from "@remix-run/react";
import { Component } from "react";

import { queryClient } from "~/api/queryClient";

import { getLiveTrainingErrorRedirect } from "../utils/liveTrainingErrorRedirect";

import type { QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";

type LiveTrainingErrorBoundaryProps = { children: ReactNode; queryKey: QueryKey };
type LiveTrainingErrorBoundaryState = { error: unknown; hasError: boolean };

export class LiveTrainingErrorBoundary extends Component<
  LiveTrainingErrorBoundaryProps,
  LiveTrainingErrorBoundaryState
> {
  state: LiveTrainingErrorBoundaryState = { error: undefined, hasError: false };

  static getDerivedStateFromError(error: unknown): LiveTrainingErrorBoundaryState {
    return { error, hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Only a failed detail query uses the former loader's redirect policy.
    // UI errors must still reach the enclosing route error boundary.
    if (queryClient.getQueryState(this.props.queryKey)?.error !== this.state.error) {
      throw this.state.error;
    }

    const destination = getLiveTrainingErrorRedirect(this.state.error);
    if (destination) return <Navigate to={destination} replace />;

    throw this.state.error;
  }
}
