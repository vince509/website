import fs from 'fs';
import path from 'path';

const appDir = process.cwd();
const uploadsDir = path.join(appDir, 'backend', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const sampleFiles = [
  {
    name: 'demo-ai-learning-analytics.txt',
    content: 'AI-Driven Learning Analytics in Higher Education\n\nThis demonstration document summarizes an educational research study on AI-powered learning analytics. It explores student engagement signals, dashboard design and advising interventions.\n\nFindings suggest that timely intervention reduces dropout risk and improves academic performance when teachers receive actionable learner insights.',
  },
  {
    name: 'demo-secure-mobile-banking.txt',
    content: 'Secure Mobile Banking Systems with Multi-Factor Authentication\n\nThis sample document addresses digital trust, secure login patterns and layered protection for financial services. The study reviews MFA, risk-based detection and session security procedures.\n\nThe research concludes that layered authentication reduces fraudulent access while preserving usability.',
  },
  {
    name: 'demo-digital-feedback-systems.txt',
    content: 'Improving Student Retention Through Digital Feedback Systems\n\nThis demonstration paper compares online feedback systems, intervention timing and digital support workflows. It highlights the value of immediate guidance in raising retention and course completion rates.\n\nThe document suggests that learning dashboards improve student motivation when paired with meaningful teacher feedback.',
  },
  {
    name: 'demo-network-optimization-campus-wifi.txt',
    content: 'Network Optimization for Campus Wi-Fi Access\n\nThis file summarizes a study on network performance, bandwidth allocation and device density across campus learning spaces. It emphasizes load balancing, monitoring and structured network segmentation.\n\nThe findings point to better reliability and lower latency for online learning environments.',
  },
];

for (const file of sampleFiles) {
  const fullPath = path.join(uploadsDir, file.name);
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, file.content, 'utf8');
  }
}

console.log('Seed files ensured in backend/uploads');
