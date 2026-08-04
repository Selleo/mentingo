import { AlertCircle, CheckCircle2, Loader2, Mail, Variable, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

import type {
  EmailPreview,
  EventDataField,
  PlaceholderMappingEntry,
  SimulationPanelState,
  SimulationResult,
} from "../simulation.types";
import type { FC } from "react";

export type { SimulationPanelState, SimulationResult };

interface SimulationPanelProps {
  open: boolean;
  onClose: () => void;
  state: SimulationPanelState;
  onRetry?: () => void;
}

export const SimulationPanel: FC<SimulationPanelProps> = ({ open, onClose, state, onRetry }) => {
  const { t } = useTranslation();

  if (state.type === "idle") {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0" noCloseButton>
        <DialogHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-semibold">
              {t("automationBuilder.simulation.title", "Wynik symulacji")}
            </DialogTitle>
            {state.type === "success" && <StatusBadge status={state.result.overallStatus} />}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="size-8">
            <X className="size-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {state.type === "loading" && <LoadingView />}

          {state.type === "error" && <ErrorView message={state.message} onRetry={onRetry} />}

          {state.type === "success" && state.result.overallStatus === "failed" && (
            <FailedResultView result={state.result} />
          )}

          {state.type === "success" && state.result.overallStatus === "success" && (
            <SuccessResultView result={state.result} />
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t("common.button.close", "Zamknij")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StatusBadge: FC<{ status: "success" | "failed" }> = ({ status }) => {
  const { t } = useTranslation();

  return (
    <Badge
      variant={status === "success" ? "default" : "destructive"}
      className={cn(
        "text-xs",
        status === "success" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
      )}
    >
      {status === "success" ? (
        <>
          <CheckCircle2 className="mr-1 size-3" />
          {t("automationBuilder.simulation.statusSuccess", "Sukces")}
        </>
      ) : (
        <>
          <AlertCircle className="mr-1 size-3" />
          {t("automationBuilder.simulation.statusFailed", "Niepowodzenie")}
        </>
      )}
    </Badge>
  );
};

const LoadingView: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {t("automationBuilder.simulation.loading", "Generowanie podglądu...")}
      </p>
    </div>
  );
};

const ErrorView: FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="size-4" />
        <AlertTitle>{t("automationBuilder.simulation.errorTitle", "Błąd symulacji")}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t("automationBuilder.simulation.retry", "Ponów symulację")}
        </Button>
      )}
    </div>
  );
};

const FailedResultView: FC<{ result: SimulationResult }> = ({ result }) => {
  const { t } = useTranslation();

  const allErrors = useMemo(
    () => result.nodeResults.flatMap((nr) => nr.errors),
    [result.nodeResults],
  );

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="size-4" />
              {t("automationBuilder.simulation.errorsTitle", "Wykryte problemy")}
              <Badge variant="destructive" className="ml-1 text-[10px]">
                {allErrors.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allErrors.map((error, idx) => (
              <Alert
                key={`${error.nodeId}-${error.field}-${idx}`}
                variant="destructive"
                className="py-3"
              >
                <AlertCircle className="size-3.5" />
                <AlertTitle className="text-xs">
                  <span className="font-medium">{error.nodeName}</span>
                  <code className="ml-2 rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-muted-foreground">
                    {error.field}
                  </code>
                </AlertTitle>
                <AlertDescription className="text-xs">{error.description}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

const SuccessResultView: FC<{ result: SimulationResult }> = ({ result }) => {
  const { t } = useTranslation();

  return (
    <Tabs defaultValue="preview" className="flex h-full flex-col">
      <TabsList className="mx-6 mt-4 w-fit">
        <TabsTrigger value="preview">
          <Mail className="mr-1.5 size-3.5" />
          {t("automationBuilder.simulation.tabPreview", "Podgląd e-maila")}
        </TabsTrigger>
        <TabsTrigger value="eventData">
          <Variable className="mr-1.5 size-3.5" />
          {t("automationBuilder.simulation.tabEventData", "Dane zdarzenia")}
        </TabsTrigger>
        <TabsTrigger value="mappings">
          {t("automationBuilder.simulation.tabMappings", "Mapowania")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="preview" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-6">
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertTitle className="text-emerald-700">
                {t(
                  "automationBuilder.simulation.readyToActivate",
                  "Automatyzacja jest gotowa do aktywacji.",
                )}
              </AlertTitle>
            </Alert>

            {result.emailPreviews.map((preview) => (
              <EmailPreviewCard key={preview.nodeId} preview={preview} />
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="eventData" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            <EventDataCard eventData={result.eventData} />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="mappings" className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-6">
            {Object.entries(result.placeholderMappings).map(([nodeId, mappings]) => {
              const nodeResult = result.nodeResults.find((nr) => nr.nodeId === nodeId);
              return (
                <PlaceholderMappingsCard
                  key={nodeId}
                  nodeName={nodeResult?.nodeName ?? nodeId}
                  mappings={mappings}
                />
              );
            })}
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
};

const EmailPreviewCard: FC<{ preview: EmailPreview }> = ({ preview }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{preview.nodeName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-1.5 border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16 font-medium text-muted-foreground">
              {t("automationBuilder.simulation.from", "Od:")}
            </span>
            <span>{preview.senderAddress}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16 font-medium text-muted-foreground">
              {t("automationBuilder.simulation.to", "Do:")}
            </span>
            <span>{preview.recipientAddress}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-16 font-medium text-muted-foreground">
              {t("automationBuilder.simulation.subject", "Temat:")}
            </span>
            <span className="font-medium">{preview.subject}</span>
          </div>
        </div>

        <iframe
          srcDoc={preview.htmlBody}
          sandbox="allow-same-origin"
          title={`Email preview: ${preview.nodeName}`}
          className="h-[400px] w-full border-0"
        />
      </CardContent>
    </Card>
  );
};

const EventDataCard: FC<{ eventData: EventDataField[] }> = ({ eventData }) => {
  const { t } = useTranslation();

  if (eventData.length === 0) {
    return (
      <Alert>
        <Variable className="size-4" />
        <AlertDescription>
          {t(
            "automationBuilder.simulation.noEventData",
            "Brak danych zdarzenia — wybierz typ triggera.",
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          {t("automationBuilder.simulation.availableVariables", "Dostępne zmienne zdarzenia")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("automationBuilder.simulation.variableName", "Zmienna")}</TableHead>
              <TableHead>{t("automationBuilder.simulation.variableLabel", "Opis")}</TableHead>
              <TableHead>{t("automationBuilder.simulation.variableType", "Typ")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventData.map((field) => (
              <TableRow key={field.key}>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {`{{${field.key}}}`}
                  </code>
                </TableCell>
                <TableCell className="text-muted-foreground">{field.label}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {field.dataType}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const PlaceholderMappingsCard: FC<{
  nodeName: string;
  mappings: PlaceholderMappingEntry[];
}> = ({ nodeName, mappings }) => {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{nodeName}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("automationBuilder.simulation.placeholder", "Placeholder")}</TableHead>
              <TableHead>{t("automationBuilder.simulation.mappedTo", "Zmapowane do")}</TableHead>
              <TableHead>
                {t("automationBuilder.simulation.sampleValue", "Wartość próbna")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((entry) => (
              <TableRow key={entry.placeholder}>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                    {`{{${entry.placeholder}}}`}
                  </code>
                </TableCell>
                <TableCell>
                  {entry.mappedVariable ? (
                    <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-700">
                      {entry.mappedVariable}
                    </code>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600">
                      <AlertCircle className="size-3" />
                      {t("automationBuilder.simulation.unmapped", "Niezmapowane")}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.sampleValue ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
