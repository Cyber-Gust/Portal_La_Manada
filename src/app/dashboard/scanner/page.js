"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../../../components/DashboardLayout";
import RequireAuth from "../../../components/RequireAuth";
import {
  QrCode, CheckCircle, XCircle, UploadCloud, History,
  Camera, CameraOff, Image as ImageIcon, RefreshCw
} from "lucide-react";

function Banner({ kind = "info", title, message }) {
  const map = {
    success: "bg-green-600 border-green-800",
    error: "bg-red-600 border-red-800",
    warning: "bg-amber-600 border-amber-800",
    info: "bg-slate-600 border-slate-800",
  };
  const cls = map[kind] || map.info;
  const Icon = kind === "success" ? CheckCircle : kind === "error" ? XCircle : QrCode;
  return (
    <div className={`p-4 rounded-lg border-l-8 ${cls} text-white`}>
      <div className="flex items-start">
        <Icon size={22} className="mr-2" />
        <div>
          <p className="font-semibold">{title}</p>
          {message && <p className="opacity-90 text-sm mt-1 whitespace-pre-wrap">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ScannerPage() {
  const containerId = "qr-reader-core";
  const html5qrRef = useRef(null);
  const [cameras, setCameras] = useState([]);            // [{id,label}]
  const [cameraId, setCameraId] = useState("");          // deviceId selecionado
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [manual, setManual] = useState("");
  const fileInputRef = useRef(null);

  // Responsivo: tamanho do qrbox baseado na largura da tela
  const qrboxSize = useMemo(() => {
    if (typeof window === "undefined") return 320;
    const w = Math.min(window.innerWidth, 960);
    if (w < 380) return 220;
    if (w < 520) return 260;
    if (w < 720) return 320;
    return 380;
  }, []);

  // Boot: descobre câmeras e escolhe uma default (traseira em mobile)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const list = await Html5Qrcode.getCameras(); // [{id,label}]
        if (!mounted) return;
        const mapped = (list || []).map(d => ({ id: d.id, label: d.label || "Camera" }));
        setCameras(mapped);

        // Heurística: traseira em mobile; se PC, a última (geralmente webcam principal)
        let pick = mapped[0]?.id || "";
        const back = mapped.find(d => /back|rear|environment|traseira/i.test(d.label));
        if (back) pick = back.id;
        else if (mapped.length > 1) pick = mapped[mapped.length - 1].id;
        setCameraId(pick);
      } catch (e) {
        setLastResult({
          kind: "warning",
          title: "Não consegui listar câmeras",
          message:
            "No iOS, use HTTPS (ngrok) e permita a câmera. Em desktop, feche apps que estejam usando a câmera (Zoom/Teams).",
        });
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Start scanning com a câmera selecionada
  const start = useCallback(async () => {
    if (!cameraId) {
      setLastResult({ kind: "warning", title: "Selecione uma câmera", message: "Nenhum device selecionado." });
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (!html5qrRef.current) {
        html5qrRef.current = new Html5Qrcode(containerId, /* verbose */ false);
      }
      await html5qrRef.current.start(
        { deviceId: { exact: cameraId } },
        {
          fps: 10,
          qrbox: qrboxSize,
          aspectRatio: 1.7778,         // 16:9 ajuda estabilidade
          disableFlip: true,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        },
        async (decodedText) => {
          if (busy) return;
          setBusy(true);
          try {
            const res = await fetch("/api/checkin/toggle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ qrCodeValue: decodedText, action: "checkin" }),
            });
            const json = await res.json();
            if (!res.ok || json.success === false) {
              setLastResult({ kind: "error", title: "ACESSO NEGADO!", message: json.error || "Ingresso inválido.", status: res.status });
            } else {
              setLastResult({ kind: "success", title: "ACESSO LIBERADO!", message: json.message || "Check-in ok.", ticket: json.ticket, status: res.status });
            }
            setHistory(prev => [
              { ts: new Date().toLocaleTimeString("pt-BR"), value: String(decodedText).slice(0, 28), ok: res.ok, name: json?.ticket?.user?.name ?? "—", status: res.status },
              ...prev,
            ].slice(0, 12));
          } finally {
            setTimeout(() => setBusy(false), 2500); // cooldown de ~2.5s
          }
        },
        () => { /* frame error: ignora */ }
      );
      setScanning(true);
    } catch (e) {
      setLastResult({
        kind: "error",
        title: "Falha ao iniciar a câmera",
        message:
          "Verifique permissões. Em Windows/Chrome, confira: chrome://settings/content/camera\n" +
          "Se outra aplicação estiver usando a câmera (Zoom/Teams), feche-a.\n\nDetalhe: " + (e?.message || String(e)),
      });
    } finally {
      setBusy(false);
    }
  }, [cameraId, qrboxSize, busy]);

  const stop = useCallback(async () => {
    setScanning(false);
    try {
      await html5qrRef.current?.stop();
      await html5qrRef.current?.clear();
    } catch {}
  }, []);

  // Troca de câmera em runtime: para e recomeça
  const handleSwapCamera = useCallback(async (id) => {
    setCameraId(id);
    if (scanning) {
      await stop();
      setTimeout(() => start(), 60);
    }
  }, [scanning, start, stop]);

  const forceCheckout = useCallback(async () => {
    const v = history[0]?.value || manual;
    if (!v) {
      setLastResult({ kind: "warning", title: "Nada para fazer check-out.", message: "Leia um QR ou informe manualmente." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/checkin/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeValue: v, action: "checkout" }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setLastResult({ kind: "error", title: "Erro no check-out", message: json.error || "Falha ao registrar saída.", status: res.status });
      } else {
        setLastResult({ kind: "success", title: "Check-out realizado!", message: json.message || "Saída registrada.", ticket: json.ticket, status: res.status });
      }
    } finally {
      setBusy(false);
    }
  }, [history, manual]);

  // Ler via imagem (fallback premium p/ iOS/Android/PC)
  const onPickImage = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = html5qrRef.current || new Html5Qrcode(containerId);
      const text = await qr.scanFile(file, true);
      const res = await fetch("/api/checkin/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeValue: text, action: "checkin" }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setLastResult({ kind: "error", title: "ACESSO NEGADO!", message: json.error || "Ingresso inválido.", status: res.status });
      } else {
        setLastResult({ kind: "success", title: "ACESSO LIBERADO!", message: json.message || "Check-in ok.", ticket: json.ticket, status: res.status });
      }
      setHistory(prev => [
        { ts: new Date().toLocaleTimeString("pt-BR"), value: String(text).slice(0, 28), ok: res.ok, name: json?.ticket?.user?.name ?? "—", status: res.status },
        ...prev,
      ].slice(0, 12));
    } catch (err) {
      setLastResult({ kind: "error", title: "Não consegui ler a foto", message: err?.message || String(err) });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const submitManual = useCallback(async (e) => {
    e.preventDefault();
    if (!manual) return;
    setBusy(true);
    try {
      const res = await fetch("/api/checkin/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeValue: manual, action: "checkin" }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) {
        setLastResult({ kind: "error", title: "ACESSO NEGADO!", message: json.error || "Ingresso inválido.", status: res.status });
      } else {
        setLastResult({ kind: "success", title: "ACESSO LIBERADO!", message: json.message || "Check-in ok.", ticket: json.ticket, status: res.status });
      }
      setHistory(prev => [{ ts: new Date().toLocaleTimeString("pt-BR"), value: String(manual).slice(0, 28), ok: res.ok, name: json?.ticket?.user?.name ?? "—", status: res.status }, ...prev].slice(0, 12));
      setManual("");
    } finally {
      setBusy(false);
    }
  }, [manual]);

  // Cleanup no unmount
  useEffect(() => () => { stop(); }, [stop]);

  return (
    <RequireAuth fallback={<div className="p-6">Verificando acesso…</div>}>
      <DashboardLayout>
        <div className="max-w-6xl mx-auto w-full min-w-0">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center min-w-0">
            <QrCode className="mr-3 shrink-0" /> <span className="truncate">Scanner La Manada</span>
          </h1>

          {err && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
              {err}
            </div>
          )}

          {/* Barra de controle */}
          <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap items-center justify-between gap-3">
            {/* Bloco esquerdo */}
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              {/* Seletor de câmera */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Câmera:</label>
                <select
                  value={cameraId}
                  onChange={(e) => handleSwapCamera(e.target.value)}
                  className="border rounded-lg p-2 min-w-48"
                >
                  {cameras.length === 0 && <option value="">Nenhuma detectada</option>}
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id}>{c.label || c.id}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleSwapCamera(cameraId)}
                  className="p-2 rounded-lg border hover:bg-gray-50"
                  title="Reiniciar com a câmera atual"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              {!scanning ? (
                <button
                  onClick={start}
                  className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Camera size={18} className="mr-2" /> Ligar câmera
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <CameraOff size={18} className="mr-2" /> Desligar câmera
                </button>
              )}

              {/* Ler via foto */}
              <label className="flex items-center px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors cursor-pointer">
                <ImageIcon size={18} className="mr-2" />
                Ler via foto
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onPickImage}
                  className="hidden"
                />
              </label>

              <button
                onClick={forceCheckout}
                disabled={busy}
                className="flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
                title="Forçar check-out do último"
              >
                <UploadCloud size={18} className="mr-2" /> Forçar Check-out
              </button>
            </div>

            {/* Manual */}
            <form onSubmit={submitManual} className="flex gap-2 items-center min-w-0 w-full sm:w-auto">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Colar valor do QR (manual)"
                className="px-3 py-2 border rounded-lg w-full sm:w-72 min-w-0"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !manual}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 shrink-0"
              >
                Check-in manual
              </button>
            </form>
          </div>

          {/* Região do vídeo (html5-qrcode injeta aqui) */}
          <div className="rounded-lg overflow-hidden shadow mb-6">
            <div
              id={containerId}
              className="mx-auto w-full"
              style={{ maxWidth: 960, minHeight: 540 }}
            />
          </div>

          {/* Feedback atual */}
          {lastResult && (
            <div className="mb-6">
              <Banner kind={lastResult.kind} title={lastResult.title} message={lastResult.message} />
            </div>
          )}

          {/* Histórico */}
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex items-center gap-2">
              <History size={18} className="text-gray-500" />
              <h2 className="text-lg font-semibold">Últimas leituras</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[18%]">Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[42%]">Conteúdo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[26%]">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-[14%]">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((h, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">{h.ts}</td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        <span className="truncate block">{h.value}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        <span className="truncate block">{h.name}</span>
                      </td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-white text-xs ${h.ok ? "bg-green-600" : "bg-red-600"}`}>
                          {h.ok ? "OK" : `Erro (${h.status})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-center text-gray-500">
                        Nenhuma leitura ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
