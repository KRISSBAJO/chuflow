"use client";
import { useState, type FormEvent } from "react";
import { apiPost } from "@/lib/api";
import { Wordmark } from "@/components/brand/wordmark";
import { Button, Field } from "@/components/ui/ui";
export function CareCheckIn({
  token,
  info,
}: {
  token: string;
  info: { churchName: string; kind: string };
}) {
  const [language, setLanguage] = useState("en");
  const [response, setResponse] = useState("well");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const es = language === "es";
  const stop = info.kind === "unsubscribe";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const d = new FormData(e.currentTarget);
    try {
      await apiPost("/care/public/" + token, {
        language,
        response: stop ? "other" : response,
        contactRequested: !stop && d.get("contactRequested") === "on",
        emailAllowed: !stop && d.get("emailAllowed") === "on",
        stopContact: stop,
        note: String(d.get("note") || ""),
        ...(d.get("until")
          ? { until: new Date(String(d.get("until"))).toISOString() }
          : {}),
      });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save your response.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#f4f3f0] px-4 py-10 sm:py-16">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <Wordmark />
          <select
            className="rounded-lg border border-black/10 px-2 py-1 text-sm"
            aria-label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
        <p className="lp-label mt-8">{info.churchName}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {done
            ? es
              ? "Gracias por responder"
              : "Thank you for letting us know"
            : stop
              ? es
                ? "Dejar de recibir mensajes"
                : "Stop care messages"
              : es
                ? "¿Cómo podemos apoyarle?"
                : "How can we support you?"}
        </h1>
        {done ? (
          <p className="mt-4 text-sm leading-7 text-[#6b6b6b]">
            {stop
              ? es
                ? "Se ha registrado su solicitud. Los mensajes automáticos de cuidado se detendrán."
                : "Your request has been recorded. Automated care messages will stop."
              : es
                ? "Su respuesta se ha compartido con el equipo correspondiente de su iglesia."
                : "Your response has been shared with the appropriate church care team."}
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            {stop ? (
              <p className="text-sm leading-7 text-[#6b6b6b]">
                {es
                  ? "Confirme que desea dejar de recibir mensajes de cuidado de su iglesia."
                  : "Confirm that you want your church to stop care contact and automated care messages."}
              </p>
            ) : (
              <>
                <Field
                  label={
                    es
                      ? "¿Qué desea compartir?"
                      : "What would you like to share?"
                  }
                >
                  <select
                    className="ui-input"
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                  >
                    {[
                      ["well", "I’m doing well", "Estoy bien"],
                      [
                        "away",
                        "I’m temporarily away",
                        "Estoy fuera temporalmente",
                      ],
                      [
                        "request_call",
                        "I would appreciate a call",
                        "Me gustaría recibir una llamada",
                      ],
                      [
                        "prayer",
                        "I have a prayer request",
                        "Tengo una petición de oración",
                      ],
                      ["moved", "I have moved", "Me he mudado"],
                      ["other", "Something else", "Otra cosa"],
                    ].map(([value, en, spanish]) => (
                      <option key={value} value={value}>
                        {es ? spanish : en}
                      </option>
                    ))}
                  </select>
                </Field>
                {response === "away" && (
                  <Field
                    label={
                      es ? "Disponible nuevamente el" : "Available again on"
                    }
                  >
                    <input
                      className="ui-input"
                      name="until"
                      type="date"
                      required
                    />
                  </Field>
                )}
                <Field label={es ? "Mensaje opcional" : "Optional message"}>
                  <textarea
                    className="ui-input min-h-32"
                    name="note"
                    maxLength={2000}
                    placeholder={
                      es
                        ? "Comparta solo lo que desee."
                        : "Share only what you are comfortable sharing."
                    }
                  />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="contactRequested" />
                  {es
                    ? "Me gustaría que el equipo me contactara sobre mi respuesta."
                    : "I would like the team to contact me about my response."}
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="emailAllowed" />
                  {es
                    ? "Doy permiso para recibir correos de cuidado de mi iglesia."
                    : "I give permission for my church to email me care messages."}
                </label>
                <p className="text-xs leading-6 text-[#8a8780]">
                  {es
                    ? "Las peticiones de oración se restringen al liderazgo. Esta respuesta no registra asistencia a un servicio."
                    : "Prayer requests are restricted to leadership. This response does not record church attendance."}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <Button type="submit" variant="flame" disabled={busy}>
              {busy
                ? es
                  ? "Guardando…"
                  : "Saving…"
                : stop
                  ? es
                    ? "Confirmar y detener mensajes"
                    : "Confirm and stop contact"
                  : es
                    ? "Enviar respuesta"
                    : "Send response"}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
