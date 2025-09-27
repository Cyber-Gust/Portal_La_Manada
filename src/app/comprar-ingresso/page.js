// app/page.js
'use client';


import React, { useState, useCallback, useEffect, useRef } from 'react';

// === FUNÇÃO DE CÁLCULO DE TAXAS (NOVO) ===
/**
 * Calcula o valor total com as taxas repassadas para o cliente.
 * @param {number} valorBase - O valor original da inscrição (ex: 150.00).
 * @param {'pix' | 'debito' | 'credito'} metodo - O método de pagamento.
 * @param {number} [parcelas=1] - O número de parcelas (para crédito).
 * @returns {number} O valor final com as taxas inclusas.
 */
const calcularValorComTaxas = (valorBase, metodo, parcelas = 1) => {
    // As taxas no Asaas são aplicadas sobre o valor *cheio*.
    let taxaFixa = 0;
    let taxaPercentual = 0;
    let taxaAntecipacao = 0; // Por parcela (mês)

    // Converte valorBase para um número seguro
    const base = Number(valorBase);
    if (isNaN(base) || base <= 0) return base;

    if (metodo === 'pix') {
        taxaFixa = 1.99;
    } else if (metodo === 'debito') {
        taxaFixa = 0.35;
        taxaPercentual = 0.0189; // 1.89%
    } else if (metodo === 'credito') {
        if (parcelas === 1) {
            // Crédito à vista
            taxaFixa = 0.49;
            taxaPercentual = 0.0299; // 2.99%
            taxaAntecipacao = 0.0125 * 1; // 1.25% x 1 mês
        } else if (parcelas >= 2 && parcelas <= 6) {
            // Crédito 2x a 6x
            taxaFixa = 0.49;
            taxaPercentual = 0.0349; // 3.49%
            // Antecipação: 1.25% por parcela (mês)
            taxaAntecipacao = 0.0125 * parcelas;
        } else if (parcelas >= 7 && parcelas <= 12) {
            // Crédito 7x a 12x
            taxaFixa = 0.49;
            taxaPercentual = 0.0399; // 3.99%
            // Antecipação: 1.25% por parcela (mês)
            taxaAntecipacao = 0.0125 * parcelas;
        }
    } else {
        return base; // Método desconhecido, retorna o valor base
    }

    // Calcula a taxa total em percentual
    const taxaTotalPercentual = taxaPercentual + taxaAntecipacao;

    /* * O cálculo de repasse é:
    * ValorFinal = (ValorBase + TaxaFixa) / (1 - TaxaTotalPercentual)
    * Isso garante que a taxa percentual (e antecipação) aplicada sobre o ValorFinal resulte no ValorBase.
    */
    const valorComRepassePercentual = (base + taxaFixa) / (1 - taxaTotalPercentual);
    
    // Arredonda para duas casas decimais
    return Number(valorComRepassePercentual.toFixed(2));
};

const NEXT_PUBLIC_APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://lgnd-la-manada.vercel.app';

export default function InscricaoPage() {
    // form | payment | card | pix | success
    const [flowStatus, setFlowStatus] = useState('form');
    const [pixData, setPixData] = useState({}); // { paymentId, qrCodeImage, pixCopiaECola }
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [asaasCustomerId, setAsaasCustomerId] = useState(null);
    const [cobrancaData, setCobrancaData] = useState({});
    const currentPaymentIdRef = useRef(null);
    const pollTimerRef = useRef(null);

    // ADD: estado/refs para o ingresso (QR)
    const [ticketInfo, setTicketInfo] = useState(null); // { status, qr_code_value, attendee, event }
    const [qrReady, setQrReady] = useState(false);
    const ticketPollRef = useRef(null);

    const VALOR_BASE_INSCRICAO = '1.00'; 
    // NOVO ESTADO: Valor final que será cobrado, inicializado com o valor base.
    const [valorFinalCobranca, setValorFinalCobranca] = useState(VALOR_BASE_INSCRICAO);

    const [formData, setFormData] = useState({
        nome: '',
        sobrenome: '',
        email: '',
        cpfCnpj: '',
        telefone: '',
        tamanho: 'p',
        legendario: 'nao',
        valorInscricao: VALOR_BASE_INSCRICAO,
     });

    const [cardForm, setCardForm] = useState({
        holderName: '',
        number: '',
        expiryMonth: '',
        expiryYear: '',
        ccv: '',
        installments: 1,
    });

    const handleFormChange = (e) =>
        setFormData((old) => ({ ...old, [e.target.name]: e.target.value }));

    const handleCardChange = (e) => {
        const { name, value } = e.target;
        // garante que number/ccv chegam como dígitos reais ao back
        let v = value;
        if (name === 'number' || name === 'ccv') v = v.replace(/\D/g, '');
        setCardForm((old) => {
            const newCardForm = { ...old, [name]: v };
            
            // Se as parcelas mudarem, recalcula o valor final
            if (name === 'installments') {
                const novoValor = calcularValorComTaxas(
                    formData.valorInscricao, // Valor Base (150.00)
                    'credito',
                    Number(v) // Nova quantidade de parcelas
                );
                setValorFinalCobranca(String(novoValor));
            }
            
            return newCardForm;
        });
    };

    const clearPolling = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    };

    const startPollingPayment = useCallback((paymentId) => {
        clearPolling();
        currentPaymentIdRef.current = paymentId;
        let attempts = 0;
        pollTimerRef.current = setInterval(async () => {
            attempts++;
            try {
                const res = await fetch(`/api/status-pagamento?paymentId=${paymentId}`);
                const data = await res.json();
                if (res.ok) {
                    const status = data?.status;
                    if (status === 'RECEIVED' || status === 'CONFIRMED') {
                        clearPolling();
                        // ADD: comece a buscar o ingresso/QR no seu backend
                        if (paymentId) startPollingTicket(paymentId);
                        setFlowStatus('success');
                        } else if (['REFUNDED', 'CHARGEBACK', 'CANCELLED'].includes(status)) {
                        clearPolling();
                        currentPaymentIdRef.current = null;
                        setErrorMsg('Pagamento não aprovado. Tente novamente.');
                    }
                }
            } catch (e) {
                console.error('Polling falhou', e);
            }
            if (attempts >= 75) {
                clearPolling(); // ~5min
                currentPaymentIdRef.current = null;
            }
        }, 4000);
    }, []);

    // ADD: limpar polling do ticket
    const clearTicketPolling = () => {
        if (ticketPollRef.current) {
            clearInterval(ticketPollRef.current);
            ticketPollRef.current = null;
        }
        };

        // ADD: polling do ticket/qr pelo paymentId
        const startPollingTicket = useCallback((paymentId) => {
        clearTicketPolling();
        let attempts = 0;
        ticketPollRef.current = setInterval(async () => {
            attempts++;
            try {
            const res = await fetch(`/api/public/ticket-by-payment?paymentId=${encodeURIComponent(paymentId)}`, { cache: 'no-store' });
            const data = await res.json();
            if (res.ok && data?.found) {
                setTicketInfo(data);
                if (data.status === 'paid' && data.qr_code_value) {
                setQrReady(true);
                clearTicketPolling();
                }
            }
            } catch (e) {
            console.warn('Polling ticket falhou', e);
            }
            // timeout de segurança (~3min)
            if (attempts >= 90) clearTicketPolling();
        }, 2000);
    }, []);

    const handleSubmitInscricao = useCallback(async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');
        try {
            const response = await fetch('/api/processar-inscricao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Erro desconhecido ao gerar cliente.');

            setAsaasCustomerId(data.customerId);
            if (data.customerId) sessionStorage.setItem('asaasCustomerId', data.customerId);
            if (data.attendeeId) sessionStorage.setItem('attendeeId', data.attendeeId);
            setFlowStatus('payment');
        } catch (error) {
            setErrorMsg(error.message || 'Falha ao processar a inscrição.');
        } finally {
            setIsLoading(false);
        }
    }, [formData]);

    const handleGeneratePix = useCallback(async () => {
        setIsLoading(true);
        setErrorMsg('');
        try {
            const cid = asaasCustomerId || sessionStorage.getItem('asaasCustomerId');
            if (!cid) throw new Error('Cliente inválido ou não informado.');

            const response = await fetch(`/api/pagamento-pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: cid,
                    valor: valorFinalCobranca,
                    valorBase: formData.valorInscricao, 
                    descricao: `Inscrição - Camisa ${formData.tamanho}`,
                    attendeeId: sessionStorage.getItem('attendeeId') || null,
                }),
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(data.error || 'Falha ao criar cobrança Pix.');

            setPixData(data); // { paymentId, qrCodeImage(data URI), pixCopiaECola }
            setFlowStatus('pix');
            if (data.paymentId) startPollingPayment(data.paymentId);
        } catch (error) {
            setErrorMsg(error.message || 'Erro ao gerar PIX.');
        } finally {
            setIsLoading(false);
        }
    }, [asaasCustomerId, formData, startPollingPayment]);

    const handlePayWithCard = useCallback(async (e) => {
        if (e?.preventDefault) e.preventDefault();
        if (e?.stopPropagation) e.stopPropagation();

        if (currentPaymentIdRef.current) return;

        if (flowStatus !== 'card') {
            setErrorMsg('Selecione primeiro a opção "Cartão de Crédito".');
            return;
        }

        setIsLoading(true);
        setErrorMsg('');
        try {
            const cid = asaasCustomerId || sessionStorage.getItem('asaasCustomerId');
            if (!cid) throw new Error('Cliente inválido ou não informado.');

            const { holderName, number, expiryMonth, expiryYear, ccv, installments } = cardForm;
            if (!holderName || !number || !expiryMonth || !expiryYear || !ccv) {
                throw new Error('Preencha todos os campos do cartão.');
            }

            const res = await fetch('/api/pagamento-cartao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: cid,
                    valor: valorFinalCobranca,
                    valorBase: formData.valorInscricao, 
                    descricao: `Inscrição - Camisa ${formData.tamanho}`,
                    card: { holderName, number, expiryMonth, expiryYear, ccv },
                    installments: Number(installments) || 1,
                    attendeeId: sessionStorage.getItem('attendeeId') || null,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || 'Falha no pagamento de cartão.');

            setCobrancaData(data); // { paymentId, status }
            if (data.paymentId) startPollingPayment(data.paymentId);
        } catch (e2) {
            setErrorMsg(e2.message || 'Erro ao processar cartão.');
        } finally {
            setIsLoading(false);
        }
    }, [flowStatus, asaasCustomerId, formData, cardForm, startPollingPayment]);

    useEffect(() => {
        const saved = sessionStorage.getItem('asaasCustomerId');
        if (saved && !asaasCustomerId) setAsaasCustomerId(saved);

        const urlParams = new URLSearchParams(window.location.search);
        const refId = urlParams.get('ref');
        if (refId) {
            setFlowStatus('success');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        return () => {
        clearPolling();
        clearTicketPolling(); // ADD
        };
    }, [asaasCustomerId]);

    useEffect(() => {
        // Redefine o valor para o base (150.00) ao voltar para 'form' ou 'payment'
        if (flowStatus === 'form' || flowStatus === 'payment') {
            setValorFinalCobranca(VALOR_BASE_INSCRICAO);
            setCardForm(old => ({ ...old, installments: 1 })); // Reseta parcelas
        }

        // Calcula a taxa PIX ao selecionar PIX
        if (flowStatus === 'pix') {
            const novoValor = calcularValorComTaxas(VALOR_BASE_INSCRICAO, 'pix');
            setValorFinalCobranca(String(novoValor));
        }

        // Calcula a taxa de crédito a vista (padrão) ao selecionar Cartão (card)
        if (flowStatus === 'card') {
            const novoValor = calcularValorComTaxas(VALOR_BASE_INSCRICAO, 'credito', cardForm.installments);
            setValorFinalCobranca(String(novoValor));
        }

    }, [flowStatus, VALOR_BASE_INSCRICAO, cardForm.installments]); // Adicione VALOR_BASE_INSCRICAO se você o definir fora do estado.

    const copiarPix = () => {
        if (pixData.pixCopiaECola) {
            navigator.clipboard.writeText(pixData.pixCopiaECola)
                .then(() => alert('Código PIX copiado!'))
                .catch(err => console.error('Falha ao copiar:', err));
        }
    };

    // ==== TELAS (estética original mantida) ====
    const FormularioInscricao = () => (
        <>
            <h1><span className='color-orange'>Manada</span> Las Campanas</h1>
            <div className="modal-itn">
                <img src="https://img.icons8.com/?size=100&id=7880&format=png&color=fb3a01" alt="Local" />
                <h3> Le Hall - São João Del Rei, MG</h3>
            </div>

            <div className="modal-itn">
                <img src="https://img.icons8.com/?size=100&id=15BVldRxijS1&format=png&color=fb3a01" alt="Data" />
                <h4 className="modal-value">11 de Outubro</h4>
            </div>

            <form onSubmit={handleSubmitInscricao}>
                <div className="form-row">
                    <div>
                        <label htmlFor="nome">Nome</label>
                        <input type="text" id="nome" name="nome" value={formData.nome} onChange={handleFormChange} required />
                    </div>
                    <div>
                        <label htmlFor="sobrenome">Sobrenome</label>
                        <input type="text" id="sobrenome" name="sobrenome" value={formData.sobrenome} onChange={handleFormChange} required />
                    </div>
                </div>

                <div className="form-row email-telefone">
                    <div>
                        <label htmlFor="email">E-mail</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleFormChange} required />
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <label htmlFor="cpfCnpj">CPF/CNPJ</label>
                        <input type="text" id="cpfCnpj" name="cpfCnpj" value={formData.cpfCnpj} onChange={handleFormChange} required />
                    </div>
                    <div>
                        <label htmlFor="telefone">Telefone</label>
                        <input type="tel" id="telefone" name="telefone" value={formData.telefone} onChange={handleFormChange} required />
                    </div>
                </div>

                <div className="form-row-itns">
                    <div>
                        <label htmlFor="tamanho">Tamanho da Camisa</label>
                        <select id="tamanho" name="tamanho" value={formData.tamanho} onChange={handleFormChange} required>
                            <option value="p">P</option>
                            <option value="m">M</option>
                            <option value="g">G</option>
                            <option value="gg">GG</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="legendario">É legendário?</label>
                        <select id="legendario" name="legendario" value={formData.legendario} onChange={handleFormChange} required>
                            <option value="">Selecione</option>
                            <option value="sim">Sim</option>
                            <option value="nao">Não</option>
                        </select>
                    </div>
                </div>

                <input type="hidden" name="valorInscricao" value={formData.valorInscricao} />

                {errorMsg && <p style={{ color: 'red', fontSize: '14px' }}>Erro: {errorMsg}</p>}
                <button className="lgnd-btn base-btn" type="submit" disabled={isLoading}>
                    {isLoading ? 'PROCESSANDO...' : 'INSCREVER JÁ!'}
                </button>
            </form>
        </>
    );

    const ModalPagamento = () => (
        <>
            <h1><span className='color-orange'>Manada</span> Las Campanas</h1>
            <h2>Escolha o Pagamento</h2>
            <p style={{ margin: '10px 0', fontSize: '18px' }}>
                Sua inscrição está quase pronta. <br /> Valor: <strong className='color-orange'>R$ {valorFinalCobranca}</strong>. {/* <--- ALTERADO AQUI */}
            </p>
            <p style={{ marginBottom: '15px', fontSize: '16px' }}>Como você prefere pagar?</p>

            <button
                type="button"
                className="base-btn"
                onClick={() => !isLoading && setFlowStatus('card')}
                disabled={isLoading}
            >
                Selecionar Cartão de Crédito
            </button>

            <button
                type="button"
                className="base-btn"
                onClick={handleGeneratePix}
                disabled={isLoading || !!currentPaymentIdRef.current}
                style={{ marginTop: '10px' }}
            >
                {isLoading ? 'Gerando PIX...' : 'Pagar com PIX'}
            </button>

            {errorMsg && <p style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>Erro: {errorMsg}</p>}
        </>
    );

    const ModalCartao = () => (
        <>
            <h1>Pagamento com Cartão</h1>

            <div className="form-row">
                <div>
                    <label htmlFor="holderName">Nome impresso</label>
                    <input id="holderName" name="holderName" type="text" value={cardForm.holderName} onChange={handleCardChange} required />
                </div>
                <div>
                    <label htmlFor="number">Número do cartão</label>
                    <input id="number" name="number" type="text" value={cardForm.number} onChange={handleCardChange} required />
                </div>
            </div>

            <div className="form-row">
                <div>
                    <label htmlFor="expiryMonth">Mês</label>
                    <input id="expiryMonth" name="expiryMonth" type="text" placeholder="MM" value={cardForm.expiryMonth} onChange={handleCardChange} required />
                </div>
                <div>
                    <label htmlFor="expiryYear">Ano</label>
                    <input id="expiryYear" name="expiryYear" type="text" placeholder="YYYY" value={cardForm.expiryYear} onChange={handleCardChange} required />
                </div>
            </div>

            <div className="form-row">
                <div>
                    <label htmlFor="ccv">CCV</label>
                    <input id="ccv" name="ccv" type="password" value={cardForm.ccv} onChange={handleCardChange} required />
                </div>
                <div>
                    <label htmlFor="installments">Parcelas</label>
                    <select id="installments" name="installments" value={cardForm.installments} onChange={handleCardChange}>
                        <option value={1}>1x</option>
                        <option value={2}>2x</option>
                        <option value={3}>3x</option>
                        <option value={6}>6x</option>
                        <option value={12}>12x</option>
                    </select>
                </div>
            </div>

            {errorMsg && <p style={{ color: 'red', fontSize: '14px' }}>Erro: {errorMsg}</p>}

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <button type="button" className="base-btn" onClick={handlePayWithCard} disabled={isLoading}>
                    {isLoading ? 'Processando...' : 'Pagar'}
                </button>
                <button
                    type="button"
                    className="base-btn"
                    onClick={() => setFlowStatus('payment')}
                    disabled={isLoading}
                    style={{ width: '150px', fontSize: '18px', padding: '6px 12px' }}
                >
                    Voltar
                </button>
            </div>
        </>
    );

    const ModalPix = () => (
        <>
            <h1>Pagamento via PIX</h1>
            <p style={{ margin: '10px 0', fontSize: '18px' }}>Escaneie o QR Code ou copie o código Pix para finalizar.</p>

            {pixData.qrCodeImage ? (
                <img src={pixData.qrCodeImage} alt="QR Code Pix" className="pix-qr-code-img" />
            ) : (
                <p style={{ fontSize: '14px' }}>Gerando QR Code...</p>
            )}

            <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Código Copia e Cola:</p>
            <textarea value={pixData.pixCopiaECola || 'Aguardando código Pix...'} rows="4" readOnly style={{ fontSize: '14px' }} />
            <button type="button" className="base-btn" onClick={copiarPix} style={{ marginTop: '10px' }}>
                Copiar Código Pix
            </button>

            <button
                type="button"
                className="base-btn"
                onClick={() => setFlowStatus('payment')}
                disabled={isLoading}
                style={{ width: '150px', fontSize: '18px', padding: '6px 12px', marginTop: '10px' }}
            >
                Voltar
            </button>

            <p style={{ marginTop: '20px', fontSize: '16px' }}>Seu acesso será liberado automaticamente após a confirmação do pagamento.</p>
            {errorMsg && <p style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>Erro: {errorMsg}</p>}
        </>
    );

    const TelaSucesso = () => {
        const handleNewRegistration = () => {
            setFlowStatus('form');
            setFormData({
            nome: '', sobrenome: '', email: '', cpfCnpj: '', telefone: '',
            tamanho: 'p', legendario: 'nao', valorInscricao: '150.00',
            });
            setErrorMsg('');
            setPixData({});
            setCobrancaData({});
            clearPolling();
            clearTicketPolling();
            currentPaymentIdRef.current = null;
            setTicketInfo(null);
            setQrReady(false);
        };

        const QrPreview = () => {
            if (!qrReady) {
            return (
                <p style={{ fontSize: 16, marginTop: 16 }}>
                Gerando seu ingresso… assim que o pagamento for conciliado, o QR aparece aqui. 🔄
                </p>
            );
            }

            const code = ticketInfo?.qr_code_value || '';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(code)}`;

            return (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <h3 style={{ marginBottom: 4 }}>Seu QR de acesso</h3>
                <img
                src={qrUrl}
                alt="QR Code do ingresso"
                width={280}
                height={280}
                style={{ display: 'block' }}
                />
                <small style={{ color: '#666' }}>
                Dica: tire um print deste QR para apresentar na entrada.
                </small>
                <details style={{ marginTop: 4 }}>
                <summary>Mostrar código</summary>
                <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{code || '—'}</code>
                </details>
            </div>
            );
        };

        return (
            <>
            <h1>✅ <br /> Pagamento Recebido!</h1>
            <p style={{ margin: '10px 0', fontSize: 18 }}>Sua inscrição está confirmada.</p>
            <p style={{ marginBottom: 15, fontSize: 16 }}>
                Verifique seu WhatsApp e e-mail. Os detalhes de acesso estão a caminho!
            </p>

            <QrPreview />

            <div style={{ marginTop: 16 }}>
                <button type="button" className="base-btn" onClick={handleNewRegistration}>
                Fazer Nova Inscrição
                </button>
            </div>
            </>
        );
    };

    const renderFlowComponent = () => {
        if (flowStatus === 'form') return FormularioInscricao();
        if (flowStatus === 'payment') return ModalPagamento();
        if (flowStatus === 'card') return ModalCartao();
        if (flowStatus === 'pix') return ModalPix();
        if (flowStatus === 'success') return TelaSucesso();
        return FormularioInscricao();
    };


    return (
        <div className="container">
            <div className="modal-content">{renderFlowComponent()}</div>
        </div>
    );
}
