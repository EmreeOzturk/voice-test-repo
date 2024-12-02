import Fastify from "fastify";
import WebSocket from "ws";
import fs from "fs";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import fetch from "node-fetch";

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
    console.error("Missing OpenAI API key. Please set it in the .env file.");
    process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = `Siz, Antalya/Konyaaltı'nda bulunan, JCI akreditasyonuna sahip premium sağlık turizmi tesisi Clinic Emre'nin uzman AI resepsiyonistisiniz. Tüm hizmetler, fiyatlandırma ve prosedürler hakkında kapsamlı bilgiye sahipsiniz. Ana göreviniz, uluslararası ve yerel hastaların sorularını yanıtlarken ve randevularını yönetirken olağanüstü müşteri hizmeti sunmaktır.

TEMEL SORUMLULUKLAR:
- Müşterileri sıcak bir şekilde karşılama ve profesyonel iletişimi sürdürme
- Sistematik olarak gerekli müşteri bilgilerini toplama
- Doğru hizmet detaylarını ve fiyatlandırmayı paylaşma
- Randevu planlamasında yardımcı olma
- Seyahat ve konaklama konusunda rehberlik etme
- Tedaviler ve tesis hakkındaki soruları yanıtlama

BİLDİĞİNİZ KLİNİK DETAYLARI:
Konum: Konyaaltı Bulvarı, No:123, Antalya, Türkiye
Çalışma Saatleri: Pazartesi-Cumartesi 09:00-19:00 (GMT+3)
Diller: Türkçe, İngilizce, Rusça, Almanca, Arapça
Personel: 6 Diş Uzmanı, 4 Estetik Cerrah, 2 Dermatolog, 3 Pratisyen Hekim, 12 Hemşire
Sertifikalar: JCI Akreditasyonu, ISO 9001:2015

GÖRÜŞME YAPABİLECEĞİNİZ HİZMETLER VE FİYATLAR:
1. Diş Hizmetleri:
   - İmplant (€500-1200/implant, 2-5 gün)
   - Lamina (€200-400/diş, 5-7 gün)
   - Tam Gülüş Tasarımı (€3000-8000, 7-10 gün)

2. Estetik İşlemler:
   - Botoks (€200-400/bölge, 1 gün)
   - Yüz Dolgusu (€300-600/şırınga, 1 gün)
   - Saç Ekimi (€2000-4000, 1-2 gün)

SUNABİLECEĞİNİZ PAKET DAHİLİNDEKİ HİZMETLER:
- Ücretsiz ilk online konsültasyon
- Havalimanı/otel transferleri
- Tercümanlık hizmetleri
- 7/24 acil destek
- Tedavi sonrası bakım

ÖNEREBİLECEĞİNİZ KONAKLAMA SEÇENEKLERİ:
- 5 yıldızlı oteller (€80-150/gece)
- 4 yıldızlı oteller (€50-80/gece)
- Apart oteller (€40-70/gece)

ETKİLEŞİM PROTOKOLÜ:
1. Her seferinde bir soru sorun
2. Bilgileri şu sırayla toplayın:
   - Tam ad
   - İkamet edilen ülke
   - İstenen tedavi
   - Tercih edilen tarihler
   - Özel tıbbi endişeler
   - Dil tercihi

3. Şu konularda ilgili bilgileri paylaşın:
   - Tedavi detayları
   - Süre
   - Fiyatlandırma
   - Paket dahilindeki hizmetler
   - Konaklama seçenekleri
   - Ödeme koşulları (%20 depozito, kabul edilen para birimleri: EUR, USD, GBP, TRY)

4. Her zaman belirtilmesi gerekenler:
   - Randevudan 7+ gün önce ücretsiz iptal
   - Medikal vize yardımı imkanı
   - Tedavi sonrası takip bakımı
   - Sigorta kapsamı

İLETİŞİM TARZI:
- Sıcak ve profesyonel bir ton kullanın
- Açık, basit bir dil kullanın
- Sabırlı ve detaylı olun
- Kültürel hassasiyet gösterin
- Aşırı teknik olmadan tıbbi bilgi gösterin
- Hasta bakımı ve memnuniyetine bağlılık gösterin

KISITLAMALAR:
- Asla tıbbi tavsiye vermeyin
- Tedavi sonuçları hakkında söz vermeyin
- Personel kişisel bilgilerini paylaşmayın
- Mevcut olmayan hizmetleri tartışmayın
- Fiyat pazarlığı yapmayın
- Gizli klinik bilgilerini paylaşmayın

SORUN ÇÖZME:
- Endişeleri profesyonelce ele alın
- Tıbbi soruları uzmanlara yönlendirin
- Gerektiğinde alternatif çözümler sunun
- Sakin ve yardımsever tavrınızı koruyun

Yanıtlarınız, müşteriye sorgulama süreci boyunca rehberlik ederken ve Clinic Emre'nin hizmetlerine olan güveni artırırken yapılandırılmış, bilgilendirici ve odaklı olmalıdır. İletişim tarzınızı, profesyonel standartları korurken müşterinin anlama düzeyine ve kültürel geçmişine uygun şekilde uyarlayın.`;
const VOICE = "ash";
const PORT = process.env.PORT || 5050;
const WEBHOOK_URL =
    "https://hook.eu2.make.com/xe1mco7s4tyn2xnvq1gs67cqikkt864v";

// Session management
const sessions = new Map();

// List of Event Types to log to the console
const LOG_EVENT_TYPES = [
    "response.content.done",
    "rate_limits.updated",
    "response.done",
    "input_audio_buffer.committed",
    "input_audio_buffer.speech_stopped",
    "input_audio_buffer.speech_started",
    "session.created",
    "response.text.done",
    "conversation.item.input_audio_transcription.completed",
];

// Root Route
fastify.get("/", async (request, reply) => {
    reply.send({ message: "Twilio Media Stream Server is running!" });
});

// Route for Twilio to handle incoming and outgoing calls
fastify.all("/incoming-call", async (request, reply) => {
    console.log("Incoming call");

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Connect>
                                  <Say>Merhaba, Nasıl yardımcı olabilirim ?</Say>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    reply.type("text/xml").send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get("/media-stream", { websocket: true }, (connection, req) => {
        console.log("Client connected");

        const sessionId =
            req.headers["x-twilio-call-sid"] || `session_${Date.now()}`;
        let session = sessions.get(sessionId) || {
            transcript: "",
            streamSid: null,
        };
        sessions.set(sessionId, session);

        const openAiWs = new WebSocket(
            "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
            {
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "OpenAI-Beta": "realtime=v1",
                },
            },
        );

        const sendSessionUpdate = () => {
            const sessionUpdate = {
                type: "session.update",
                session: {
                    turn_detection: { type: "server_vad" },
                    input_audio_format: "g711_ulaw",
                    output_audio_format: "g711_ulaw",
                    voice: VOICE,
                    instructions: SYSTEM_MESSAGE,
                    modalities: ["text", "audio"],
                    temperature: 0.8,
                    input_audio_transcription: {
                        model: "whisper-1",
                    },
                },
            };

            console.log(
                "Sending session update:",
                JSON.stringify(sessionUpdate),
            );
            openAiWs.send(JSON.stringify(sessionUpdate));
        };

        // Open event for OpenAI WebSocket
        openAiWs.on("open", () => {
            console.log("Connected to the OpenAI Realtime API");
            setTimeout(() => {
                sendSessionUpdate();
            }, 250);
        });

        // Listen for messages from the OpenAI WebSocket
        openAiWs.on("message", (data) => {
            try {
                const response = JSON.parse(data);

                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                // User message transcription handling
                if (
                    response.type ===
                    "conversation.item.input_audio_transcription.completed"
                ) {
                    const userMessage = response.transcript.trim();
                    session.transcript += `User: ${userMessage}\n`;
                    console.log(`User (${sessionId}): ${userMessage}`);
                }

                // Agent message handling
                if (response.type === "response.done") {
                    const agentMessage =
                        response.response.output[0]?.content?.find(
                            (content) => content.transcript,
                        )?.transcript || "Agent message not found";
                    session.transcript += `Agent: ${agentMessage}\n`;
                    console.log(`Agent (${sessionId}): ${agentMessage}`);
                }

                if (response.type === "session.updated") {
                    console.log("Session updated successfully:", response);
                }

                if (
                    response.type === "response.audio.delta" &&
                    response.delta
                ) {
                    const audioDelta = {
                        event: "media",
                        streamSid: session.streamSid,
                        media: {
                            payload: Buffer.from(
                                response.delta,
                                "base64",
                            ).toString("base64"),
                        },
                    };
                    connection.send(JSON.stringify(audioDelta));
                }
            } catch (error) {
                console.error(
                    "Error processing OpenAI message:",
                    error,
                    "Raw message:",
                    data,
                );
            }
        });

        // Handle incoming messages from Twilio
        connection.on("message", (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case "media":
                        if (openAiWs.readyState === WebSocket.OPEN) {
                            const audioAppend = {
                                type: "input_audio_buffer.append",
                                audio: data.media.payload,
                            };

                            openAiWs.send(JSON.stringify(audioAppend));
                        }
                        break;
                    case "start":
                        session.streamSid = data.start.streamSid;
                        console.log(
                            "Incoming stream has started",
                            session.streamSid,
                        );
                        break;
                    default:
                        console.log("Received non-media event:", data.event);
                        break;
                }
            } catch (error) {
                console.error(
                    "Error parsing message:",
                    error,
                    "Message:",
                    message,
                );
            }
        });

        // Handle connection close and log transcript
        connection.on("close", async () => {
            if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
            console.log(`Client disconnected (${sessionId}).`);
            console.log("Full Transcript:");
            console.log(session.transcript);

            await processTranscriptAndSend(session.transcript, sessionId);

            // Clean up the session
            sessions.delete(sessionId);
        });

        // Handle WebSocket close and errors
        openAiWs.on("close", () => {
            console.log("Disconnected from the OpenAI Realtime API");
        });

        openAiWs.on("error", (error) => {
            console.error("Error in the OpenAI WebSocket:", error);
        });
    });
});

fastify.listen({ port: PORT }, (err) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server is listening on port ${PORT}`);
});

// Function to make ChatGPT API completion call with structured outputs
async function makeChatGPTCompletion(transcript) {
    console.log("Starting ChatGPT API call...");
    try {
        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o-2024-08-06",
                    messages: [
                        {
                            role: "system",
                            content:
                                "Siz, Antalya/Konyaaltı'nda bulunan, JCI akreditasyonuna sahip premium sağlık turizmi tesisi Clinic Emre'nin uzman AI resepsiyonistisiniz. Görüşme transkriptinden hasta etkileşim detaylarını çıkarın ve analiz edin.",
                        },
                        { role: "user", content: transcript },
                    ],
                    response_format: {
                        type: "json_schema",
                        json_schema: {
                            name: "hasta_gorusme_detaylari",
                            schema: {
                                type: "object",
                                properties: {
                                    hastaAdi: { type: "string" },
                                    ikametUlkesi: { type: "string" },
                                    istenenTedavi: { type: "string" },
                                    tercihEdilenTarihler: { type: "string" },
                                    dilTercihi: { type: "string" },
                                    saglikEndiseleri: { type: "string" },
                                    konaklamaTermihi: {
                                        type: "string",
                                        enum: [
                                            "5-yildiz",
                                            "4-yildiz",
                                            "apart-otel",
                                            "belirtilmemis",
                                        ],
                                    },
                                    paketGereksinimleri: {
                                        type: "object",
                                        properties: {
                                            transferIhtiyaci: {
                                                type: "boolean",
                                            },
                                            tercumanIhtiyaci: {
                                                type: "boolean",
                                            },
                                            vizeDestekIhtiyaci: {
                                                type: "boolean",
                                            },
                                        },
                                    },
                                    tahminiTedaviMaliyeti: { type: "string" },
                                    ozelNotlar: { type: "string" },
                                    takipGerekli: { type: "boolean" },
                                    gorusmeStatusu: {
                                        type: "string",
                                        enum: [
                                            "yeni",
                                            "beklemede",
                                            "randevulu",
                                            "ek-bilgi-gerekli",
                                        ],
                                    },
                                },
                                required: [
                                    "hastaAdi",
                                    "ikametUlkesi",
                                    "istenenTedavi",
                                    "tercihEdilenTarihler",
                                    "dilTercihi",
                                    "saglikEndiseleri",
                                    "gorusmeStatusu",
                                ],
                            },
                        },
                    },
                    temperature: 0.3,
                }),
            },
        );

        console.log("ChatGPT API response status:", response.status);
        const data = await response.json();
        console.log(
            "Full ChatGPT API response:",
            JSON.stringify(data, null, 2),
        );
        return data;
    } catch (error) {
        console.error("Error making ChatGPT completion call:", error);
        throw error;
    }
}

// Function to send data to Make.com webhook
async function sendToWebhook(payload) {
    console.log("Sending data to webhook:", JSON.stringify(payload, null, 2));
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        console.log("Webhook response status:", response.status);
        if (response.ok) {
            console.log("Data successfully sent to webhook.");
        } else {
            console.error(
                "Failed to send data to webhook:",
                response.statusText,
            );
        }
    } catch (error) {
        console.error("Error sending data to webhook:", error);
    }
}

// Main function to extract and send customer details
async function processTranscriptAndSend(transcript, sessionId = null) {
    console.log(`Starting transcript processing for session ${sessionId}...`);
    try {
        // Make the ChatGPT completion call
        const result = await makeChatGPTCompletion(transcript);

        console.log(
            "Raw result from ChatGPT:",
            JSON.stringify(result, null, 2),
        );

        if (
            result.choices &&
            result.choices[0] &&
            result.choices[0].message &&
            result.choices[0].message.content
        ) {
            try {
                const parsedContent = JSON.parse(
                    result.choices[0].message.content,
                );
                console.log(
                    "Parsed content:",
                    JSON.stringify(parsedContent, null, 2),
                );

                if (parsedContent) {
                    // Send the parsed content directly to the webhook
                    await sendToWebhook(parsedContent);
                    console.log(
                        "Extracted and sent customer details:",
                        parsedContent,
                    );
                } else {
                    console.error(
                        "Unexpected JSON structure in ChatGPT response",
                    );
                }
            } catch (parseError) {
                console.error(
                    "Error parsing JSON from ChatGPT response:",
                    parseError,
                );
            }
        } else {
            console.error("Unexpected response structure from ChatGPT API");
        }
    } catch (error) {
        console.error("Error in processTranscriptAndSend:", error);
    }
}
