import { AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS, USER_SOCKET_EVENTS } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCancelAiJudgeConfigurationGeneration } from "~/api/mutations/admin/useCancelAiJudgeConfigurationGeneration";
import { useReviseAiJudgeConfigurationGeneration } from "~/api/mutations/admin/useReviseAiJudgeConfigurationGeneration";
import { useStartAiJudgeConfigurationGeneration } from "~/api/mutations/admin/useStartAiJudgeConfigurationGeneration";
import {
  AI_JUDGE_CONFIGURATION_GENERATION_QUERY_KEY,
  useAiJudgeConfigurationGenerationSnapshot,
} from "~/api/queries/admin/useAiJudgeConfigurationGenerationSnapshot";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";

import { AI_JUDGE_GENERATION_STATUS } from "./aiJudgeConfiguration.types";
import { mapAiJudgeGenerationSnapshotToViewState } from "./aiJudgeGeneration.mappers";

import type { AiJudgeGenerationSnapshot } from "./aiJudgeGeneration.mappers";
import type { GenerateBody } from "~/api/generated-api";

export const useAiJudgeConfigurationGeneration = () => {
  const { t } = useTranslation();
  const [generationId, setGenerationId] = useState<string>();
  const { mutateAsync: startAiJudgeConfigurationGeneration, isPending: isStarting } =
    useStartAiJudgeConfigurationGeneration();
  const { mutateAsync: cancelAiJudgeConfigurationGeneration, isPending: isCancelling } =
    useCancelAiJudgeConfigurationGeneration();
  const { mutateAsync: reviseAiJudgeConfigurationGeneration, isPending: isRevising } =
    useReviseAiJudgeConfigurationGeneration();
  const {
    data: generationSnapshot,
    refetch: refetchGenerationSnapshot,
    isFetching: isFetchingGenerationSnapshot,
  } = useAiJudgeConfigurationGenerationSnapshot(generationId);

  useEffect(() => {
    if (generationSnapshot?.progress.status === AI_JUDGE_GENERATION_STATUS.CANCELLED) {
      setGenerationId(undefined);
    }
  }, [generationSnapshot]);

  useEffect(() => {
    if (!generationId) return;

    const socket = acquireSocket();
    const generationQueryKey = [
      ...AI_JUDGE_CONFIGURATION_GENERATION_QUERY_KEY,
      generationId,
    ] as const;
    const handleConnect = () => {
      socket.emit(USER_SOCKET_EVENTS.JOIN);
      void refetchGenerationSnapshot();
    };
    const handleProgress = (snapshot: AiJudgeGenerationSnapshot) => {
      if (snapshot.generationId !== generationId) return;
      queryClient.setQueryData(generationQueryKey, snapshot);
    };

    socket.on("connect", handleConnect);
    socket.on(AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS, handleProgress);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS, handleProgress);
      releaseSocket();
    };
  }, [generationId, refetchGenerationSnapshot]);

  const state = useMemo(
    () =>
      generationSnapshot
        ? mapAiJudgeGenerationSnapshotToViewState(generationSnapshot, t)
        : undefined,
    [generationSnapshot, t],
  );

  const startGeneration = async (input: GenerateBody) => {
    const { generationId: nextGenerationId } = await startAiJudgeConfigurationGeneration(input);
    const initialSnapshot: AiJudgeGenerationSnapshot = {
      generationId: nextGenerationId,
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
        attempt: 1,
        attemptHistory: [],
      },
    };

    queryClient.setQueryData(
      [...AI_JUDGE_CONFIGURATION_GENERATION_QUERY_KEY, nextGenerationId],
      initialSnapshot,
    );
    setGenerationId(nextGenerationId);
  };

  const cancelGeneration = async () => {
    if (!generationId) return;
    await cancelAiJudgeConfigurationGeneration(generationId);
  };

  const reviseGeneration = async () => {
    if (!generationId || !generationSnapshot) return;
    const { generationId: nextGenerationId } =
      await reviseAiJudgeConfigurationGeneration(generationId);
    const initialSnapshot: AiJudgeGenerationSnapshot = {
      generationId: nextGenerationId,
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
        attempt: generationSnapshot.progress.attempt + 1,
        attemptHistory: generationSnapshot.progress.attemptHistory,
      },
    };

    queryClient.setQueryData(
      [...AI_JUDGE_CONFIGURATION_GENERATION_QUERY_KEY, nextGenerationId],
      initialSnapshot,
    );
    setGenerationId(nextGenerationId);
  };

  const resetGeneration = () => {
    setGenerationId(undefined);
  };

  return {
    generationId,
    state,
    startGeneration,
    cancelGeneration,
    reviseGeneration,
    resetGeneration,
    isStarting,
    isCancelling,
    isRevising,
    isFetchingGenerationSnapshot,
  };
};
