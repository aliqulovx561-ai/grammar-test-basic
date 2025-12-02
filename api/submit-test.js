export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { name, score, total, timeUsed, answers } = req.body;

    // Validate required fields
    if (!name || score === undefined || !total || !timeUsed || !answers) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Get environment variables
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // Check if Telegram credentials are set
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Telegram credentials not set in environment variables');
      // Still return success to user, but log error
      console.log('Test result (Telegram not configured):', {
        name,
        score: `${score}/${total}`,
        timeUsed: `${Math.floor(timeUsed / 60)}m ${timeUsed % 60}s`
      });

      return res.status(200).json({
        success: true,
        message: 'Test submitted successfully (Telegram not configured)',
        data: {
          name,
          score,
          total,
          percentage: Math.round((score / total) * 100),
          timeUsed
        }
      });
    }

    // Format time
    const minutes = Math.floor(timeUsed / 60);
    const seconds = timeUsed % 60;
    const timeFormatted = `${minutes}m ${seconds}s`;

    // Calculate percentage
    const percentage = Math.round((score / total) * 100);

    // Get current date and time
    const now = new Date();
    const testDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const testTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Group answers by section
    const sections = {};
    answers.forEach(answer => {
      if (!sections[answer.section]) {
        sections[answer.section] = { correct: 0, total: 0 };
      }
      sections[answer.section].total++;
      if (answer.isCorrect) {
        sections[answer.section].correct++;
      }
    });

    // Create detailed report for Telegram
    let report = `📊 *ENGLISH GRAMMAR TEST RESULT*\n\n`;
    
    // Header
    report += `*Candidate:* ${name}\n`;
    report += `*Date:* ${testDate}\n`;
    report += `*Time:* ${testTime}\n`;
    report += `*Duration:* ${timeFormatted}\n\n`;
    
    // Overall Score
    report += `*OVERALL SCORE*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    report += `🎯 *${score}/${total} (${percentage}%)*\n\n`;
    
    // Performance rating
    let rating = '';
    if (percentage >= 90) rating = '🏆 EXCELLENT';
    else if (percentage >= 80) rating = '🎯 VERY GOOD';
    else if (percentage >= 70) rating = '👍 GOOD';
    else if (percentage >= 60) rating = '📚 SATISFACTORY';
    else if (percentage >= 50) rating = '⚠️ NEEDS IMPROVEMENT';
    else rating = '📖 UNSATISFACTORY';
    
    report += `*Performance:* ${rating}\n\n`;
    
    // Section-wise breakdown
    report += `*SECTION-WISE PERFORMANCE*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    for (const [section, data] of Object.entries(sections)) {
      const sectionPercent = Math.round((data.correct / data.total) * 100);
      const progressBar = createProgressBar(sectionPercent);
      
      let emoji = '❌';
      if (sectionPercent >= 80) emoji = '✅';
      else if (sectionPercent >= 60) emoji = '⚠️';
      
      report += `${emoji} *${section}*\n`;
      report += `   ${progressBar} ${sectionPercent}%\n`;
      report += `   ${data.correct}/${data.total} correct\n\n`;
    }
    
    // Weak areas
    const weakAreas = Object.entries(sections)
      .filter(([_, data]) => (data.correct / data.total) < 0.7)
      .map(([section]) => section);
    
    if (weakAreas.length > 0) {
      report += `*AREAS NEEDING IMPROVEMENT*\n`;
      report += `━━━━━━━━━━━━━━━━━━━━\n`;
      weakAreas.forEach(area => {
        report += `• ${area}\n`;
      });
      report += `\n`;
    }
    
    // Detailed question analysis (first 5 questions)
    report += `*SAMPLE QUESTIONS ANALYSIS*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    const sampleQuestions = answers.slice(0, 5);
    sampleQuestions.forEach((answer, index) => {
      const emoji = answer.isCorrect ? '✅' : '❌';
      report += `${emoji} Q${index + 1}: ${answer.question}\n`;
      report += `   Your answer: ${answer.userAnswer}\n`;
      if (!answer.isCorrect) {
        report += `   Correct: ${answer.correctAnswer}\n`;
      }
      report += `\n`;
    });
    
    // Recommendations
    report += `*RECOMMENDATIONS*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (percentage >= 80) {
      report += `• Excellent performance! Maintain regular practice.\n`;
      report += `• Consider more advanced grammar topics.\n`;
    } else if (percentage >= 60) {
      report += `• Good effort. Focus on weak areas.\n`;
      report += `• Review incorrect answers.\n`;
    } else {
      report += `• Review basic grammar rules.\n`;
      report += `• Practice each section thoroughly.\n`;
      report += `• Take the test again after studying.\n`;
    }
    
    report += `\nTest completed successfully! 🎉`;

    // Send to Telegram
    try {
      const telegramResult = await sendToTelegram(report, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
      
      console.log('Test submitted successfully:', {
        name,
        score: `${score}/${total}`,
        percentage: `${percentage}%`,
        timeUsed: timeFormatted,
        telegramSent: telegramResult.ok
      });

      return res.status(200).json({
        success: true,
        message: 'Test submitted successfully',
        data: {
          name,
          score,
          total,
          percentage,
          timeUsed: timeFormatted,
          telegramSent: telegramResult.ok
        }
      });
      
    } catch (telegramError) {
      console.error('Telegram error:', telegramError);
      
      // Still return success to user
      return res.status(200).json({
        success: true,
        message: 'Test submitted (Telegram notification failed)',
        data: {
          name,
          score,
          total,
          percentage,
          timeUsed: timeFormatted
        }
      });
    }

  } catch (error) {
    console.error('Error processing submission:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

// Helper function to create progress bar
function createProgressBar(percentage) {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Function to send message to Telegram
async function sendToTelegram(message, botToken, chatId) {
  try {
    // Split message if too long (Telegram limit: 4096 characters)
    const maxLength = 4000;
    let messages = [message];
    
    if (message.length > maxLength) {
      // Split by sections
      const sections = message.split('━━━━━━━━━━━━━━━━━━━━\n');
      messages = [];
      let currentMessage = '';
      
      for (const section of sections) {
        const sectionWithHeader = '━━━━━━━━━━━━━━━━━━━━\n' + section;
        if ((currentMessage + sectionWithHeader).length > maxLength) {
          if (currentMessage) messages.push(currentMessage);
          currentMessage = sectionWithHeader;
        } else {
          currentMessage += sectionWithHeader;
        }
      }
      if (currentMessage) messages.push(currentMessage);
    }
    
    // Send all messages
    for (let i = 0; i < messages.length; i++) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: messages[i],
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      });
      
      const result = await response.json();
      
      // Wait between messages to avoid rate limiting
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      if (!result.ok) {
        throw new Error(result.description || 'Telegram API error');
      }
    }
    
    return { ok: true };
    
  } catch (error) {
    console.error('Telegram API error:', error);
    return { 
      ok: false, 
      error: error.message 
    };
  }
}
