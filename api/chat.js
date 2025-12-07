// نقطة نهاية Vercel Serverless Function لعمل كـ Proxy آمن لـ DeepSeek API

// يتم سحب هذا المتغير من إعدادات Vercel Environment Variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

// رابط API الخاص بـ DeepSeek
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

// نماذج DeepSeek المتاحة
const AVAILABLE_MODELS = {
    'deepseek-chat': 'deepseek-chat',
    'deepseek-reasoner': 'deepseek-reasoner'
};

export default async function handler(req, res) {
    // 1. التحقق من مفتاح API (الأمان)
    if (!DEEPSEEK_API_KEY) {
        return res.status(500).json({ 
            message: 'DEEPSEEK_API_KEY is missing on Vercel. Please add it to your environment variables.',
            hint: 'Get free API key from: https://platform.deepseek.com'
        });
    }

    // 2. التحقق من طريقة الطلب
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 3. سحب البيانات المرسلة من الواجهة الأمامية
        const { messages, model, max_tokens = 4096, temperature = 0.7 } = req.body;
        
        if (!messages || messages.length === 0) {
            return res.status(400).json({ message: 'Missing messages in request body.' });
        }

        // 4. التحقق من صحة النموذج المطلوب
        const selectedModel = AVAILABLE_MODELS[model] || AVAILABLE_MODELS['deepseek-chat'];

        // 5. تحويل الرسائل إلى تنسيق DeepSeek
        const deepseekMessages = convertToDeepSeekFormat(messages);

        // 6. بناء حمولة الطلب لإرسالها إلى DeepSeek
        const requestBody = {
            model: selectedModel,
            messages: deepseekMessages,
            max_tokens: Math.min(max_tokens, 8192), // الحد الأقصى لـ DeepSeek
            temperature: temperature,
            stream: false
        };

        // 7. استدعاء DeepSeek API بشكل آمن
        const deepseekResponse = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        // 8. التحقق من رد DeepSeek
        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { error: { message: errorText } };
            }
            
            console.error('DeepSeek API Error:', errorData);
            
            // رسائل خطأ مخصصة بالعربية
            let userMessage = '❌ حدث خطأ في الاتصال بـ DeepSeek API';
            if (deepseekResponse.status === 401) {
                userMessage = '❌ مفتاح API غير صالح. يرجى التحقق من المفتاح في إعدادات Vercel.';
            } else if (deepseekResponse.status === 429) {
                userMessage = '⚠️ تم تجاوز حد الطلبات المسموح به. يرجى الانتظار قليلاً.';
            } else if (deepseekResponse.status === 404) {
                userMessage = `❌ النموذج ${selectedModel} غير متاح.`;
            }
            
            return res.status(deepseekResponse.status).json({ 
                message: userMessage,
                details: errorData.error?.message || "DeepSeek API failed to respond."
            });
        }

        // 9. معالجة الرد الناجح
        const data = await deepseekResponse.json();
        
        if (!data.choices || data.choices.length === 0) {
            return res.status(500).json({ 
                message: 'لم يتمكن DeepSeek من توليد رد.',
            });
        }

        // استخراج النص من الرد
        const choice = data.choices[0];
        let botResponse = choice.message.content || '';
        
        if (!botResponse || botResponse.trim() === '') {
            botResponse = 'عذراً، لم أتمكن من فهم السؤال. يمكنك إعادة صياغته أو إرفاق صورة أكثر وضوحاً.';
        }

        // 10. إرجاع الرد الناجح إلى الواجهة الأمامية
        return res.status(200).json({ 
            response: botResponse,
            model: selectedModel,
            usage: data.usage || {}
        });

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ 
            message: 'خطأ داخلي في الخادم',
            error: error.message
        });
    }
}

// دالة مساعدة لتحويل المحتوى إلى تنسيق DeepSeek
function convertToDeepSeekFormat(messages) {
    const deepseekMessages = [];

    for (const message of messages) {
        if (message.role === 'system') {
            // إضافة رسالة النظام
            deepseekMessages.push({
                role: 'system',
                content: message.content
            });
        } else if (message.role === 'user' && message.content) {
            // معالجة محتوى المستخدم (نصوص وصور)
            const parts = [];
            
            for (const content of message.content) {
                if (content.type === 'text') {
                    parts.push({
                        type: 'text',
                        text: content.text
                    });
                } else if (content.type === 'image_url') {
                    // استخراج Base64 من Data URL
                    const base64Image = content.image_url.url.split(',')[1];
                    const mimeType = extractMimeType(content.image_url.url);
                    
                    // DeepSeek تدعم صيغة image_url مباشرة
                    parts.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`
                        }
                    });
                }
            }
            
            deepseekMessages.push({
                role: 'user',
                content: parts
            });
        } else if (message.role === 'assistant') {
            // رسائل المساعد السابقة
            deepseekMessages.push({
                role: 'assistant',
                content: message.content
            });
        }
    }

    return deepseekMessages;
}

// دالة مساعدة لاستخراج نوع MIME من Data URL
function extractMimeType(dataUrl) {
    const match = dataUrl.match(/^data:(.*?);base64,/);
    return match ? match[1] : 'image/jpeg';
}
