// app/page.js
'use client';


import React, { useState, useCallback, useEffect, useRef } from 'react';

// === FUNÇÃO DE CÁLCULO DE TAXAS ===
/**
 * Calcula o valor total com as taxas repassadas para o cliente.
 * @param {string} valorBase - O valor original da inscrição (ex: '150.00').
 * @param {'pix' | 'debito' | 'credito'} metodo - O método de pagamento.
 * @param {number} [parcelas=1] - O número de parcelas (para crédito).
 * @returns {number} O valor final com as taxas inclusas.
 */
const calcularValorComTaxas = (valorBase, metodo, parcelas = 1) => {
    let taxaFixa = 0;
    let taxaPercentual = 0;
    let taxaAntecipacao = 0;

    const base = Number(valorBase);
    if (isNaN(base) || base <= 0) return base;

    if (metodo === 'pix') {
        taxaFixa = 1.99;
    } else if (metodo === 'debito') {
        taxaFixa = 0.35;
        taxaPercentual = 0.0189; // 1.89%
    } else if (metodo === 'credito') {
        if (parcelas === 1) {
            taxaFixa = 0.49;
            taxaPercentual = 0.0299; // 2.99%
            taxaAntecipacao = 0.0125 * 1; // 1.25% x 1 mês
        } else if (parcelas >= 2 && parcelas <= 6) {
            taxaFixa = 0.49;
            taxaPercentual = 0.0349; // 3.49%
            taxaAntecipacao = 0.0125 * parcelas;
        } else if (parcelas >= 7 && parcelas <= 12) {
            taxaFixa = 0.49;
            taxaPercentual = 0.0399; // 3.99%
            taxaAntecipacao = 0.0125 * parcelas;
        }
    } else {
        return base;
    }

    const taxaTotalPercentual = taxaPercentual + taxaAntecipacao;

    /* Fórmula de Repasse: ValorFinal = (ValorBase + TaxaFixa) / (1 - TaxaTotalPercentual) */
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

    const VALOR_BASE_INSCRICAO = '140.00';
    // NOVO ESTADO: Valor final que será cobrado, inicializado com o valor base.
    const [valorFinalCobranca, setValorFinalCobranca] = useState(VALOR_BASE_INSCRICAO);

    // adicione perto dos demais states
    const [holderExtra, setHolderExtra] = useState({
        postalCode: '',
        addressNumber: '',
    });
    const handleHolderExtraChange = (e) => {
        const { name, value } = e.target;
        setHolderExtra(prev => ({ ...prev, [name]: value }));
    };

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

            // NOVO: Calcula o valor PIX com taxas imediatamente antes da chamada API
            const pixValorComTaxas = calcularValorComTaxas(
                formData.valorInscricao,
                'pix'
            );
            // Atualiza o estado para refletir na UI (ModalPix)
            setValorFinalCobranca(String(pixValorComTaxas));

            const response = await fetch(`/api/pagamento-pix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerId: cid,
                    // Usa o valor recém-calculado com taxas
                    valor: pixValorComTaxas,
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
                    // 👇 extra transitório, sem persistência
                    holder: {
                        postalCode: holderExtra.postalCode,       // CEP
                        addressNumber: holderExtra.addressNumber, // Nº
                    }
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
    }, [flowStatus, asaasCustomerId, formData, cardForm, startPollingPayment, valorFinalCobranca]);

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

            <div className='main-container'>
                <div className='description'>

                    <img className='logo-manada' src="/captura-images/logo-manada.png" alt="Manada Las Campanas" />
                    <div className="modal-itn">
                        <img src="https://img.icons8.com/?size=100&id=7880&format=png&color=fb3a01" alt="Local" />
                        <h3> Le Hall - São João Del Rei, MG</h3>
                    </div>

                    <div className="modal-itn">
                        <img src="https://img.icons8.com/?size=100&id=15BVldRxijS1&format=png&color=fb3a01" alt="Data" />
                        <h4 className="modal-value">11 de Outubro | Sábado</h4> 
                        <span className="orange-txt">140,00</span>
                    </div>

                    

                    <img className='camisa' src="/captura-images/camisa.png" alt="" />

                    <div className='desc-text'>
                     <h1 className='desc-txt-h1'><span className='color-orange'>CHURRASCO</span> DESAFIOS <span className='color-orange'>PALAVRA</span> COMUNÃO</h1>
                     <p>Checkin com entrega das camisas às 8:30H</p>
                    </div>

                </div>

                <div className='form-content'>
                    <h1>Preencha sua inscrição!</h1>
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
                </div>
            </div>
        </>
    );

    const ModalPagamento = () => (
        <>
             <img className='logo-manada' src="/captura-images/logo-manada.png" alt="Manada Las Campanas" />
            <p style={{ margin: '10px 0', fontSize: '18px' }}>
                Sua inscrição está quase pronta.</p>
                <h1>Investimento: <strong className='color-orange'>R${valorFinalCobranca}</strong>.</h1>
            <p style={{ marginBottom: '15px', fontSize: '16px' }}>Selecione a forma de pagamento.</p>

            <a
                href="https://www.asaas.com/c/231edy12snpnbbt6" // Mude esta URL para o seu destino
                className="base-btn" // Mantém a mesma classe de estilo
            // Remova o onClick, type e disabled se eles não forem mais necessários
            >Cartão de Crédito
            </a>

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

    const ModalCartao = () => {
        // Formata o valor final para exibição
        const valorFormatado = Number(valorFinalCobranca).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });

        // Calcula o valor das taxas para exibir
        const valorTaxas = Number(valorFinalCobranca) - Number(formData.valorInscricao);
        const taxaFormatada = valorTaxas.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        return (
            <>
                <h1>Pagamento com Cartão</h1>

                {/* NOVO: Exibe o valor final com detalhes */}
                <p
                    style={{
                        margin: '10px 0',
                        fontSize: '16px',
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                    }}
                >
                    <strong className="color-orange" style={{ fontSize: '18px' }}>
                        Valor Final: {valorFormatado}
                    </strong>
                    <br />
                    <small>
                        ({Number(cardForm.installments)}x de{' '}
                        {Number(valorFinalCobranca / cardForm.installments).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                        })}
                        )
                    </small>
                    <br />
                    <small style={{ color: '#666' }}>
                        (Ingresso: R$ {formData.valorInscricao} + Taxas: {taxaFormatada})
                    </small>
                </p>

                <div className="form-row">
                    <div>
                        <label htmlFor="holderName">Nome impresso</label>
                        <input
                            id="holderName"
                            name="holderName"
                            type="text"
                            value={cardForm.holderName}
                            onChange={handleCardChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="number">Número do cartão</label>
                        <input
                            id="number"
                            name="number"
                            type="text"
                            value={cardForm.number}
                            onChange={handleCardChange}
                            required
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <label htmlFor="expiryMonth">Mês</label>
                        <input
                            id="expiryMonth"
                            name="expiryMonth"
                            type="text"
                            placeholder="MM"
                            value={cardForm.expiryMonth}
                            onChange={handleCardChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="expiryYear">Ano</label>
                        <input
                            id="expiryYear"
                            name="expiryYear"
                            type="text"
                            placeholder="YYYY"
                            value={cardForm.expiryYear}
                            onChange={handleCardChange}
                            required
                        />
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <label htmlFor="ccv">CCV</label>
                        <input
                            id="ccv"
                            name="ccv"
                            type="password"
                            value={cardForm.ccv}
                            onChange={handleCardChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="installments">Parcelas</label>
                        <select
                            id="installments"
                            name="installments"
                            value={cardForm.installments}
                            onChange={handleCardChange}
                        >
                            <option value={1}>1x</option>
                            <option value={2}>2x</option>
                            <option value={3}>3x</option>
                            <option value={6}>6x</option>
                            <option value={12}>12x</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
                    <div>
                        <label htmlFor="postalCode">CEP (opcional, ajuda aprovar)</label>
                        <input
                            id="postalCode"
                            name="postalCode"
                            type="text"
                            placeholder="Somente números"
                            value={holderExtra.postalCode}
                            onChange={handleHolderExtraChange}
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                    </div>
                    <div>
                        <label htmlFor="addressNumber">Nº Endereço (opcional)</label>
                        <input
                            id="addressNumber"
                            name="addressNumber"
                            type="text"
                            value={holderExtra.addressNumber}
                            onChange={handleHolderExtraChange}
                        />
                    </div>
                </div>

                {errorMsg && (
                    <p style={{ color: 'red', fontSize: '14px' }}>Erro: {errorMsg}</p>
                )}

                <div
                    style={{
                        marginTop: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        alignItems: 'center',
                    }}
                >
                    <button
                        type="button"
                        className="base-btn"
                        onClick={handlePayWithCard}
                        disabled={isLoading}
                    >
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
    };

    const ModalPix = () => {
        // Formata o valor final para exibição
        const valorFormatado = Number(valorFinalCobranca).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });

        // Calcula o valor das taxas para exibir
        const valorTaxas = Number(valorFinalCobranca) - Number(formData.valorInscricao);
        const taxaFormatada = valorTaxas.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        const hasPixCode = Boolean(pixData?.pixCopiaECola);

        return (
            <>
                <h1>Pagamento via PIX</h1>

                {/* NOVO: Exibe o valor final com detalhes */}
                <p
                    style={{
                        margin: '10px 0',
                        fontSize: '16px',
                        padding: '10px',
                        borderRadius: '4px',
                        backgroundColor: 'transparent',
                    }}
                >
                    <strong className="color-orange" style={{ fontSize: '18px' }}>
                        Valor Final: {valorFormatado}
                    </strong>
                    <br />
                    <small style={{ color: '#666' }}>
                        (Ingresso: R$ {formData.valorInscricao} + Taxas: {taxaFormatada})
                    </small>
                </p>

                <p style={{ margin: '10px 0', fontSize: '18px' }}>
                    Escaneie o QR Code ou copie o código Pix para finalizar.
                </p>

                {pixData?.qrCodeImage ? (
                    <img src={pixData.qrCodeImage} alt="QR Code Pix" className="pix-qr-code-img" />
                ) : (
                    <p style={{ fontSize: '14px' }}>Gerando QR Code...</p>
                )}

                <p style={{ fontWeight: 'bold', marginTop: '10px' }}>Código Copia e Cola:</p>
                <textarea
                    value={hasPixCode ? pixData.pixCopiaECola : 'Aguardando código Pix...'}
                    rows={4}
                    readOnly
                    style={{ fontSize: '14px' }}
                />

                <button
                    type="button"
                    className="base-btn"
                    onClick={copiarPix}
                    style={{ marginTop: '10px' }}
                    disabled={!hasPixCode}
                    title={hasPixCode ? 'Copiar código Pix' : 'Aguarde gerar o código'}
                >
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

                <p style={{ marginTop: '20px', fontSize: '16px' }}>
                    Seu acesso será liberado automaticamente após a confirmação do pagamento.
                </p>

                {errorMsg && (
                    <p style={{ color: 'red', fontSize: '14px', marginTop: '10px' }}>Erro: {errorMsg}</p>
                )}
            </>
        );
    };

    const TelaSucesso = () => {
        const handleNewRegistration = () => {
            setFlowStatus('form');
            setFormData({
                nome: '', sobrenome: '', email: '', cpfCnpj: '', telefone: '',
                tamanho: 'p', legendario: 'nao', valorInscricao: { valorFinalCobranca },
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

        const downloadTicketPDF = () => {
            if (!qrReady || !ticketInfo?.qr_code_value) return;

            // Gera a URL do QR Code
            const base64QrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(ticketInfo.qr_code_value)}`;
            const nomeCompleto = `${formData.nome} ${formData.sobrenome}`;
            const cpfCnpj = formData.cpfCnpj;
            const camisa = formData.tamanho.toUpperCase();

            // Conteúdo HTML estilizado para impressão em PDF
            const printContent = `
                <html>
                <head>
                    <title>Ingresso - Manada Las Campanas</title>
                    <style>
                        body { font-family: sans-serif; margin: 0; padding: 0; background-color: #f0f0f0; }
                        .ticket-container { 
                            width: 100%; max-width: 600px; margin: 30px auto; padding: 30px; 
                            background: white; border-radius: 12px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1); 
                            border: 3px solid #fb3a01; 
                        }
                        .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
                        .header h1 { color: #2c3e50; font-size: 28px; margin: 0; }
                        .header h1 span { color: #fb3a01; }
                        .qr-area { text-align: center; margin: 25px 0; }
                        .qr-area img { border: 5px solid #2c3e50; border-radius: 8px; }
                        .details { margin-top: 20px; }
                        .details p { margin: 5px 0; font-size: 16px; color: #34495e; }
                        .details strong { font-weight: 700; color: #fb3a01; }
                        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 15px; }
                        @media print {
                            body { background-color: white; }
                            .ticket-container { 
                                box-shadow: none; 
                                border: 1px solid #000;
                                margin: 0; 
                                max-width: 100%;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="ticket-container">
                        <div class="header">
                            <h1>Ingresso <span>Manada</span> Las Campanas</h1>
                            <p>CONFIRMADO - Acesso Único</p>
                        </div>
                        <div class="qr-area">
                            <h2>Apresente este QR Code na entrada</h2>
                            <img src="${base64QrUrl}" alt="QR Code do Ingresso" width="250" height="250" />
                        </div>
                        <div class="details">
                            <p><strong>Evento:</strong> Manada Las Campanas</p>
                            <p><strong>Local:</strong> Le Hall - São João Del Rei, MG</p>
                            <p><strong>Data:</strong> 11 de Outubro</p>
                        </div>
                        <div class="details">
                            <p><strong>Nome:</strong> ${nomeCompleto}</p>
                            <p><strong>Documento:</strong> ${cpfCnpj}</p>
                            <p><strong>Tamanho Camisa:</strong> <strong>${camisa}</strong></p>
                        </div>
                        <div class="footer">
                            <p>ID Ingresso: ${ticketInfo.qr_code_value}</p>
                            <p>Este documento não é fiscal. Válido apenas para acesso ao evento.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                // Pequeno delay para garantir que o navegador carregue o QR e o estilo
                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);
            }
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

                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <button
                        type="button"
                        className="lgnd-btn base-btn"
                        onClick={downloadTicketPDF}
                        disabled={!qrReady}
                        style={{ backgroundColor: qrReady ? '#27ae60' : '#bdc3c7', fontSize: '30px'  }}
                    >
                        ⬇️ Baixar Ingresso PDF
                    </button>
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
            <div className="range">
                <div className="range-track">
                    {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="range-element">
                            <img src="captura-images/lgnd-ico.png" alt="Ícone" />
                            <h1>LGND LAS CAMPANAS</h1>
                        </div>
                    ))}
                </div>
            </div>

            <div className="modal-content">{renderFlowComponent()}</div>
        </div>
    );
}
