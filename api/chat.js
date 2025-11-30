// نقطة نهاية Vercel Serverless Function لعمل كـ Proxy آمن لـ DeepSeek API

// متغير البيئة الآمن الذي سيتم سحبه من إعدادات Vercel
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; 

// رابط API الخاص بـ DeepSeek
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

export default async function handler(req, res) {
    // التحقق من مفتاح API (الأمان)
    if (!DEEPSEEK_API_KEY) {
        return res.status(500).json({ error: 'DEEPSEEK_API_KEY is not configured in Vercel Environment Variables.' });
    }

    // السماح فقط لطلبات POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // سحب المحتوى (الرسالة والصور Base64) الذي تم إرساله من الواجهة الأمامية
        const { contents } = req.body;
        
        if (!contents || contents.length === 0) {
             return res.status(400).json({ error: 'Missing chat contents in request body.' });
        }

        // بناء حمولة الطلب (Payload) لإرسالها إلى DeepSeek
        const requestBody = {
            model: "deepseek-v2", // يمكنك تغيير النموذج هنا
            messages: [{
                role: "user",
                content: contents // يحتوي على النصوص والصور بصيغة Base64
            }],
            stream: false // للاستجابة الكاملة مرة واحدة
        };

        // استدعاء DeepSeek API بشكل آمن
        const deepseekResponse = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // استخدام المفتاح المخزن في متغيرات البيئة
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!deepseekResponse.ok) {
            const errorData = await deepseekResponse.json().catch(() => ({}));
            // إرجاع رسالة خطأ واضحة في حال فشل الاتصال بـ DeepSeek
            return res.status(deepseekResponse.status).json({ 
                message: "DeepSeek API failed to respond.",
                details: errorData.error?.message || deepseekResponse.statusText 
            });
        }

        // معالجة الرد
        const data = await deepseekResponse.json();
        const botResponse = data.choices[0].message.content;

        // إرجاع الرد إلى الواجهة الأمامية (Client)
        return res.status(200).json({ response: botResponse });

    } catch (error) {
        console.error('Serverless Function Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
