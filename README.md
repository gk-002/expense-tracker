# 🪙 Expense Splitter & Settlement Ledger

> A fast, fair, and exact dinner bill and expense splitter designed for zero-rounding discrepancies, instant UPI settlements, and smart cost-imbalance alerts.

[![Live App](https://img.shields.io/badge/Live_App-Shared_Preview-10b981?style=for-the-badge&logo=google-chrome&logoColor=white)](https://ais-pre-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app)
[![Dev Environment](https://img.shields.io/badge/Dev_App-Development_Server-0ea5e9?style=for-the-badge&logo=google-cloud&logoColor=white)](https://ais-dev-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/gk-002/expense-tracker)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-ffca28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)

---

## 🌐 Active Operational Links

| Resource | URL & Link | Description |
| :--- | :--- | :--- |
| 🚀 **Live Production App** | [https://ais-pre-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app](https://ais-pre-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app) | Publicly accessible live deployment for end users |
| 🛠️ **Development App Server** | [https://ais-dev-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app](https://ais-dev-i4ys7dybooehnia44acw2n-691660099830.asia-east1.run.app) | Active cloud development environment |
| 💻 **Local Dev Server** | [http://localhost:3000](http://localhost:3000) | Standard local development URL when running Vite locally |
| 📂 **GitHub Repository** | [https://github.com/gk-002/expense-tracker](https://github.com/gk-002/expense-tracker) | Official source code repository |
| 📧 **Maintainer Contact** | [mailto:myslfgk24@gmail.com](mailto:myslfgk24@gmail.com) | Direct inquiries & developer contact |

---

## ✨ Key Features

### 1. 🎯 Exact-Penny (Paisa) Arithmetic
- **Zero Rounding Error**: Calculates shares down to the integer paise. If ₹100.00 is split among 3 people, it distributes shares as `₹33.34`, `₹33.33`, and `₹33.33`, ensuring the exact sum matches the total bill.
- **Rupee (`₹`) Formatting**: Built with Indian Rupee formatting standards and decimal precision.
- **Tip & Tax Support**: Flexible tip percentages (0%, 5%, 10%, 15%, 20%) plus custom Rupee tip inputs.
- **Equal & Custom Splits**: Toggle between standard equal distribution and custom itemized share allocation.

### 2. 📱 UPI QR Code Generation & Settlement Matrix
- **Per-Person UPI QR Code**: Dynamically generates valid UPI payment QR codes (`upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...`) for debtors to pay creditors instantly.
- **Customizable UPI IDs**: Edit and save individual UPI IDs per participant (e.g. `rahul@okaxis`, `priya@upi`) with persistence.
- **One-Click Payments**: Direct *"Pay in App"* deeplink and *"Save QR"* image download options.
- **Minimized Settlement Ledger**: Computes bilateral debt settlements with minimal cash transactions.

### 3. 🚨 In-App Notification System & Cost Imbalance Flagging
- **Imbalance Alerts**: Flags when any individual's share exceeds a configured percentage (default **50%**) of the total bill.
- **Adjustable Sensitivity**: Interactive range slider (20% – 80%) and quick presets (35%, 40%, 50%, 60%) to calibrate alert sensitivity.
- **Notification Dropdown Center**: Top navigation bell with pulsating alert counter, individual issue cards, one-click *"Inspect in Splitter"*, and dismissal controls.
- **Visual Status Badges**: Amber visual border highlighting and warning tags on affected participant cards.

### 4. 📊 Collection Progress & "Mark as Paid" Tracking
- **Payment Toggles**: Clickable *"Mark as Paid"* / *"Marked as Paid ✓"* status per participant.
- **Real-Time Progress Bar**: Visual collection bar showing completed vs. pending amount and completion percentage.
- **Batch Controls**: Quick *"Mark All Paid"* and *"Clear All Paid"* buttons.

### 5. 💾 Reload-Proof Persistence & Cloud Sync
- **Zero Data Loss on Reload**: Synchronously persists all active bills, calculations, and inputs to `localStorage`. Page refreshes will never wipe active results.
- **Dedicated "Clear All"**: Safe separate reset button ensures data is only cleared when explicitly confirmed.
- **Firebase Auth & Firestore**: Optional Google Sign-In to sync split records across devices into Cloud Firestore (`users/{userId}/splits`).

### 6. 📁 Multi-Format Data Export
- 📄 **Itemized Receipt (`.txt`)**: Clean text format receipt ready for printing or messaging.
- 📊 **Spreadsheet (`.csv`)**: Full tabular breakdown compatible with Microsoft Excel and Google Sheets.
- 💻 **Structured Ledger (`.json`)**: Machine-readable JSON object including participants, integer paise shares, and settlement matrix.
- 📋 **WhatsApp / Clipboard Summary**: Formatted settlement text copied in one click.

### 7. 🎨 Glassmorphic Dark & Light Theme
- Professional frosted-glass aesthetic (`backdrop-blur-xl`, subtle specular borders, and clean typography).
- Responsive on all form factors (mobile phones, tablets, and desktop displays).
- Instant Dark/Light mode toggle located in the top navigation bar.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite 8](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **QR Code Engine**: [qrcode](https://www.npmjs.com/package/qrcode)
- **Backend & Cloud Database**: [Firebase Auth](https://firebase.google.com/docs/auth) & [Cloud Firestore](https://firebase.google.com/docs/firestore)

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js (v18.0 or newer)
- npm or pnpm

### 1. Clone the Repository
```bash
git clone https://github.com/gk-002/expense-tracker.git
cd expense-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to access the app locally.

### 4. Build for Production
```bash
npm run build
```
The optimized production bundle will be generated in the `dist/` directory.

### 5. Run Type Check & Linter
```bash
npm run lint
```

---

## 🗂️ Project Structure

```text
├── src/
│   ├── App.tsx          # Main application containing Splitter, Dashboard, History & QR Engine
│   ├── firebase.ts      # Firebase configuration, Auth provider & Firestore initialization
│   ├── main.tsx         # React DOM entry point
│   └── index.css        # Tailwind CSS imports & global styles
├── firestore.rules      # Production-hardened security rules for user splits
├── firebase-blueprint.json # Schema specification for Firestore entities
├── index.html           # HTML5 entry template with viewport & SEO meta
├── package.json         # Scripts and project dependencies
├── tsconfig.json        # TypeScript configuration
└── README.md            # Project documentation with active operational links
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Feel free to use and adapt this tool for your dining, roommate, or group travel settlements!
