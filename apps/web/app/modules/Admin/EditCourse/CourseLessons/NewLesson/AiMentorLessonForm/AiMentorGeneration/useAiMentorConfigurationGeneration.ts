import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  USER_SOCKET_EVENTS,
} from "@repo/shared";
import { useEffect, useMemo, useState } from "react";

import { useCancelAiMentorConfigurationGeneration } from "~/api/mutations/admin/useCancelAiMentorConfigurationGeneration";
import { useReviseAiMentorConfigurationGeneration } from "~/api/mutations/admin/useReviseAiMentorConfigurationGeneration";
import { useStartAiMentorConfigurationGeneration } from "~/api/mutations/admin/useStartAiMentorConfigurationGeneration";
import {
  AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY,
  useAiMentorConfigurationGenerationSnapshot,
} from "~/api/queries/admin/useAiMentorConfigurationGenerationSnapshot";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";

import { mapAiMentorGenerationSnapshotToViewState } from "./aiMentorGeneration.mappers";

import type {
  AiMentorGenerationSnapshot,
  AiMentorGenerationViewState,
} from "./aiMentorGeneration.types";
import type { AiMentorType } from "@repo/shared";
import type { GenerateAiMentorConfigurationBody } from "~/api/generated-api";

const getRequestedConfigurationType = (
  input: GenerateAiMentorConfigurationBody,
): AiMentorType =>
  input.mode === AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE
    ? input.configurationType
    : input.currentConfiguration.type;

export const useAiMentorConfigurationGeneration = () => {
  const [generationId, setGenerationId] = useState<string>();
  const [generationType, setGenerationType] = useState<AiMentorType>();
  const { mutateAsync: startAiMentorConfigurationGeneration, isPending: isStarting } =
    useStartAiMentorConfigurationGeneration();
  const { mutateAsync: cancelAiMentorConfigurationGeneration, isPending: isCancelling } =
    useCancelAiMentorConfigurationGeneration();
  const { mutateAsync: reviseAiMentorConfigurationGeneration, isPending: isRevising } =
    useReviseAiMentorConfigurationGeneration();
  const {
    data: generationSnapshot,
    refetch: refetchGenerationSnapshot,
    isFetching: isFetchingGenerationSnapshot,
  } = useAiMentorConfigurationGenerationSnapshot(generationId);

  useEffect(() => {
    if (!generationId) return;

    const socket = acquireSocket();
    const generationQueryKey = [
      ...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY,
      generationId,
    ] as const;
    const handleConnect = () => {
      socket.emit(USER_SOCKET_EVENTS.JOIN);
      void refetchGenerationSnapshot();
    };
    const handleProgress = (snapshot: AiMentorGenerationSnapshot) => {
      if (snapshot.generationId !== generationId) return;
      queryClient.setQueryData(generationQueryKey, snapshot);
    };

    socket.on("connect", handleConnect);
    socket.on(AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS, handleProgress);
    socket.connect();

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off(AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS, handleProgress);
      releaseSocket();
    };
  }, [generationId, refetchGenerationSnapshot]);

  const state = useMemo<AiMentorGenerationViewState | undefined>(() => {
    if (!generationSnapshot || !generationType) return;
    return mapAiMentorGenerationSnapshotToViewState(generationSnapshot, generationType);
  }, [generationSnapshot, generationType]);

  const startGeneration = async (input: GenerateAiMentorConfigurationBody) => {
    const requestedType = getRequestedConfigurationType(input);
    setGenerationType(requestedType);
    const { generationId: nextGenerationId } =
      await startAiMentorConfigurationGeneration(input);
    const initialSnapshot: AiMentorGenerationSnapshot = {
      generationId: nextGenerationId,
      progress: {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
        attempt: 1,
        attemptHistory: [],
      },
    };

    queryClient.setQueryData(
      [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, nextGenerationId],
      initialSnapshot,
    );
    setGenerationId(nextGenerationId);
  };

  const cancelGeneration = async () => {
    if (!generationId) return;
    await cancelAiMentorConfigurationGeneration(generationId);
    await queryClient.invalidateQueries({
      queryKey: [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, generationId],
    });
  };

  const reviseGeneration = async () => {
    if (!generationId || !generationSnapshot) return;
    const { generationId: nextGenerationId } =
      await reviseAiMentorConfigurationGeneration(generationId);
    const initialSnapshot: AiMentorGenerationSnapshot = {
      generationId: nextGenerationId,
      progress: {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
        attempt: generationSnapshot.progress.attempt + 1,
        attemptHistory: generationSnapshot.progress.attemptHistory,
      },
    };

    queryClient.setQueryData(
      [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, nextGenerationId],
      initialSnapshot,
    );
    setGenerationId(nextGenerationId);
  };

  const resetGeneration = () => {
    setGenerationId(undefined);
    setGenerationType(undefined);
  };

  return {
    generationId,
    generationType,
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
