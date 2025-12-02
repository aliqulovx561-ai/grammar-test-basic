export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name,
      score,
      total,
      timeUsed,
      answers,
      testDuration
    } = req.body;

    // Get Telegram credentials from environment variables
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // Check if Telegram credentials are set
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Telegram credentials not set in environment variables');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
    }

    // Format time
    const minutes = Math.floor(timeUsed / 60);
    const seconds = timeUsed % 60;
    const timeFormatted = `${minutes}m ${seconds}s`;
    const totalTimeFormatted = `${Math.floor(testDuration / 60)}m`;

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
      minute: '2-digit'
    });

    // Group answers by section for analysis
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

    // ==================== PREPARE DETAILED TELEGRAM REPORT ====================
    
    let report = `📊 *ENGLISH GRAMMAR TEST - DETAILED REPORT*\n\n`;
    
    // Candidate Information
    report += `*👤 CANDIDATE INFORMATION*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    report += `• Name: ${name}\n`;
    report += `• Test Date: ${testDate}\n`;
    report += `• Test Time: ${testTime}\n`;
    report += `• Duration: ${timeFormatted} / ${totalTimeFormatted}\n\n`;
    
    // Overall Score
    report += `*🎯 OVERALL PERFORMANCE*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    report += `• Score: ${score}/${total}\n`;
    report += `• Percentage: ${percentage}%\n`;
    
    // Add performance emoji
    let performanceEmoji = '';
    if (percentage >= 90) performanceEmoji = '🏆 EXCELLENT';
    else if (percentage >= 75) performanceEmoji = '🎯 VERY GOOD';
    else if (percentage >= 60) performanceEmoji = '👍 GOOD';
    else if (percentage >= 50) performanceEmoji = '📚 FAIR';
    else performanceEmoji = '📖 NEEDS IMPROVEMENT';
    
    report += `• Performance: ${performanceEmoji}\n\n`;
    
    // Section-wise Analysis
    report += `*📈 SECTION-WISE ANALYSIS*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    for (const [section, data] of Object.entries(sections)) {
      const sectionPercent = Math.round((data.correct / data.total) * 100);
      
      // Choose emoji based on performance
      let sectionEmoji = '❌';
      if (sectionPercent >= 80) sectionEmoji = '✅';
      else if (sectionPercent >= 60) sectionEmoji = '⚠️';
      
      // Create progress bar
      const progressBarLength = 10;
      const filledLength = Math.round((sectionPercent / 100) * progressBarLength);
      const emptyLength = progressBarLength - filledLength;
      const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
      
      report += `${sectionEmoji} *${section}*\n`;
      report += `   ${progressBar} ${sectionPercent}%\n`;
      report += `   Score: ${data.correct}/${data.total}\n\n`;
    }
    
    // Question-by-Question Breakdown
    report += `*📝 QUESTION-BY-QUESTION BREAKDOWN*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    answers.forEach((answer, index) => {
      const qNumber = index + 1;
      const emoji = answer.isCorrect ? '✅' : '❌';
      const status = answer.isCorrect ? 'Correct' : 'Incorrect';
      
      report += `${emoji} *Q${qNumber}:* ${status}\n`;
      report += `   • Section: ${answer.section}\n`;
      report += `   • Your Answer: ${answer.userAnswer}\n`;
      report += `   • Correct Answer: ${answer.correctAnswer}\n`;
      
      if (!answer.isCorrect) {
        report += `   • Result: ❌ Needs review\n`;
      }
      
      report += `\n`;
    });
    
    // Weak Areas
    report += `*🎯 AREAS FOR IMPROVEMENT*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    const weakSections = Object.entries(sections)
      .filter(([_, data]) => (data.correct / data.total) < 0.7)
      .map(([section, data]) => {
        const percent = Math.round((data.correct / data.total) * 100);
        return { section, percent };
      });
    
    if (weakSections.length > 0) {
      weakSections.forEach(({ section, percent }) => {
        report += `• *${section}:* ${percent}% (Below 70%)\n`;
      });
    } else {
      report += `🎉 All sections performed well!\n`;
    }
    report += `\n`;
    
    // Recommendations
    report += `*💡 RECOMMENDATIONS*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (percentage >= 90) {
      report += `• Excellent performance! Maintain your study habits.\n`;
      report += `• Consider more advanced grammar topics.\n`;
    } else if (percentage >= 75) {
      report += `• Good performance. Focus on weak areas.\n`;
      report += `• Practice regularly to maintain consistency.\n`;
    } else if (percentage >= 60) {
      report += `• Fair performance. Review all incorrect answers.\n`;
      report += `• Focus on sections below 70%.\n`;
    } else {
      report += `• Needs improvement. Review basic grammar rules.\n`;
      report += `• Practice each section thoroughly.\n`;
    }
    
    if (weakSections.length > 0) {
      report += `• Priority: Focus on `;
      report += weakSections.map(ws => ws.section).join(', ');
      report += `\n`;
    }
    
    report += `\n*📊 Test completed successfully!*\n`;
    report += `━━━━━━━━━━━━━━━━━━━━\n`;

    // ==================== SEND TO TELEGRAM ====================
    
    try {
      const telegramResponse = await sendToTelegram(report, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID);
      
      if (!telegramResponse.ok) {
        console.error('Failed to send to Telegram:', telegramResponse);
      }
      
      // Log to console for debugging
      console.log('Test submitted:', {
        name,
        score: `${score}/${total}`,
        percentage: `${percentage}%`,
        timeUsed: timeFormatted,
        telegramSent: telegramResponse.ok
      });

      return res.status(200).json({
        success: true,
        message: 'Test submitted successfully',
        details: {
          name,
          score: `${score}/${total}`,
          percentage: `${percentage}%`,
          timeUsed: timeFormatted,
          telegramSent: telegramResponse.ok
        }
      });

    } catch (telegramError) {
      console.error('Telegram error:', telegramError);
      
      // Still return success to user even if Telegram fails
      return res.status(200).json({
        success: true,
        message: 'Test submitted (Telegram notification failed)',
        details: {
          name,
          score: `${score}/${total}`,
          percentage: `${percentage}%`,
          timeUsed: timeFormatted,
          telegramSent: false
        }
      });
    }

  } catch (error) {
    console.error('Error in submit-test handler:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

async function sendToTelegram(message, botToken, chatId) {
  try {
    // Split message if too long (Telegram has 4096 character limit)
    const maxLength = 4000;
    const messages = [];
    
    if (message.length > maxLength) {
      // Split by sections
      const sections = message.split('━━━━━━━━━━━━━━━━━━━━\n');
      let currentMessage = '';
      
      for (const section of sections) {
        if ((currentMessage + section).length > maxLength) {
          messages.push(currentMessage);
          currentMessage = section;
        } else {
          currentMessage += (currentMessage ? '━━━━━━━━━━━━━━━━━━━━\n' : '') + section;
        }
      }
      if (currentMessage) {
        messages.push(currentMessage);
      }
    } else {
      messages.push(message);
    }
    
    // Send all message parts
    const results = [];
    for (const msg of messages) {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: msg,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          })
        }
      );
      
      const result = await response.json();
      results.push(result);
      
      // Wait a bit between messages to avoid rate limiting
      if (messages.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results[0]; // Return first response
    
  } catch
