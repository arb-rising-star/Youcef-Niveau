// نقطة نهاية Vercel Serverless Function لعمل كـ Proxy آمن لـ DeepSeek API

// يتم سحب هذا المتغير من إعدادات Vercel Environment Variables
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; 

// رابط API الخاص بـ DeepSeek
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

export default async function handler(req, res) {
    // 1. التحقق من مفتاح API (الأمان)
    if (!DEEPSEEK_API_KEY) {
        return res.status(500).json({ message: 'DEEPSEEK_API_KEY is missing on Vercel.' });
    }

    // 2. التحقق من طريقة الطلب
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // 3. سحب المحتوى المرسل من الواجهة الأمامية
        const { contents } = req.body;
        
        if (!contents || contents.length === 0) {
             return res.status(400).json({ message: 'Missing chat contents in request body.' });
        }

        // 4. بناء حمولة الطلب (Payload) لإرسالها إلى DeepSeek
        const requestBody = {
            model: "deepseek-v2", // النموذج الذي يدعم الرؤية (Vision)
            messages: [{
                role: "user",
                content: contents 
            }],
            stream: false 
        };

        // 5. استدعاء DeepSeek API بشكل آمن باستخدام المفتاح السري
        const deepseekResponse = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // استخدام المفتاح المخزن في متغيرات البيئة
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        // 6. التحقق من رد DeepSeek
        if (!deepseekResponse.ok) {
            const errorData = await deepseekResponse.json().catch(() => ({}));
            // إرجاع رسالة خطأ واضحة في حال فشل الاتصال بـ DeepSeek
            return res.status(deepseekResponse.status).json({ 
                message: errorData.error?.message || "DeepSeek API failed to respond."
            });
        }

        // 7. إرجاع الرد الناجح إلى الواجهة الأمامية
        const data = await deepseekResponse.json();
        const botResponse = data.choices[0].message.content;

        return res.status(200).json({ response: botResponse });

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
