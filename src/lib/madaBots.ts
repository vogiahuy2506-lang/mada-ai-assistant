/**
 * 7 Bot MADA - Mapping frontend
 * Dùng để hiển thị agent list, badge category, và import seed.
 * Cập nhật: Thêm kịch bản mẫu, thiết bị cụ thể, và tiêu chuẩn đầy đủ
 */

export interface MadaBotInfo {
  id: string;           // agent id (cũng là botId)
  name: string;
  nameVi: string;
  nameAr: string;       // Arabic name
  nameFr: string;       // French name
  avatar: string;
  description: string;
  descriptionVi: string;       // Mô tả tiếng Việt chi tiết hơn
  descriptionAr: string;       // Arabic description
  descriptionFr: string;       // French description
  madaCategory: string;
  madaUrl: string;
  // Tiêu chuẩn ISO/WHO/WCAG
  isoCodes: string[];
  // Mã ICD (cho Bot 3, 4)
  icdCodes?: string[];
  // Tiêu chuẩn CE/ANSI
  regulatoryCodes?: string[];
  // Thiết bị cụ thể được đề cập trong kịch bản
  featuredDevices: {
    name: string;
    nameVi: string;
    type: string;
    description: string;
  }[];
  // Kịch bản mẫu
  sampleScenario: {
    vi: string;
    en: string;
  };
  // Chế độ chuyên gia cung cấp gì
  expertModeFeatures: string[];
  // System prompt riêng cho từng agent (inject vào RAG engine)
  systemPrompt: string;
  // Persona VN/EN/AR/FR cho End-User mode và AT Specialist mode
  personaEndUser: { vi: string; en: string; ar: string; fr: string };
  personaSpecialist: { vi: string; en: string; ar: string; fr: string };
}

export const MADA_BOTS: MadaBotInfo[] = [
  // ==================== BOT 1: SENSORY - HEARING ====================
  {
    id: 'bot-hearing',
    name: 'Bot 1: Sensory – Hearing',
    nameVi: 'CẢM GIÁC - THÍNH GIÁC',
    nameAr: 'الإحساس - السمع',
    nameFr: 'SENS - AUDITION',
    avatar: '👂',
    description: 'Hỗ trợ người suy giảm thính lực với thiết bị trợ thính và cảnh báo',
    descriptionVi: 'Hỗ trợ người dùng bị giảm thính lực nhẹ đến nặng, cung cấp thông tin về máy trợ thính, thiết bị cảnh báo bằng ánh sáng/xúc giác, hệ thống FM, và các tiêu chuẩn kiểm chứng an toàn kỹ thuật.',
    descriptionAr: 'دعم المستخدمين الذين يعانون من ضعف السمع من خفيف إلى شديد، وتقديم معلومات عن أجهزة السمع وتنبيهات الضوء/اللمس وأنظمة FM والمعايير التقنية.',
    descriptionFr: 'Soutien aux utilisateurs atteints de déficience auditive légère à sévère, informations sur les prothèses auditives, alertes visuelles/tactiles, systèmes FM et normes techniques.',
    madaCategory: 'sensory-hearing',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/sensory-hearing/',
    isoCodes: ['22.06.06', '22.09.06', '22.18.03', 'IEC 60118', 'ISO 8253-1'],
    regulatoryCodes: ['IEC 60118-4', 'ISO 8253-1'],
    featuredDevices: [
      {
        name: 'Phonak Lyric',
        nameVi: 'Phonak Lyric',
        type: 'Hearing Aid',
        description: 'Thiết bị trợ thính ẩn sâu trong tai, đeo liên tục nhiều tháng'
      },
      {
        name: 'Bellman',
        nameVi: 'Bellman & Symfon',
        type: 'Alert System',
        description: 'Thiết bị cảnh báo bằng ánh sáng và xúc giác cho người điếc'
      },
      {
        name: 'Roger FM System',
        nameVi: 'Roger FM System',
        type: 'Assistive Listening',
        description: 'Hệ thống FM không dây cho lớp học/hội nghị, giảm ồn tới 61%'
      },
      {
        name: 'Oticon More',
        nameVi: 'Oticon More Hearing Aid',
        type: 'Hearing Aid',
        description: 'Máy trợ thính AI Deep Neural Network, chống ồn thông minh'
      }
    ],
    sampleScenario: {
      vi: 'Hỗ trợ người dùng bị giảm thính lực nhẹ với thiết bị trợ thính Phonak Lyric ẩn sâu trong tai hoặc thiết bị cảnh báo bằng ánh sáng/xúc giác Bellman. Ở chế độ chuyên gia CNHT, hệ thống cung cấp hướng dẫn kiểm chứng tiêu chuẩn an toàn kỹ thuật IEC 60118 và ISO 8253-1.',
      en: 'Support for users with mild hearing loss using Phonak Lyric hearing aids hidden deep in the ear or Bellman light/tactile alert devices. In AT Specialist mode, the system provides guidance on IEC 60118 and ISO 8253-1 technical safety standards verification.'
    },
    expertModeFeatures: [
      'Hướng dẫn kiểm chứng IEC 60118-4 (đo đặc tính kỹ thuật máy trợ thính)',
      'So sánh công nghệ BTE vs CIC vs IIC về gain frequency response',
      'Cài đặt Roger FM system cho môi trường lớp học',
      'Phân tích tiêu chuẩn ISO 8253-1 cho đo thính lực'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ THÍNH GIÁC (Sensory – Hearing) tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Máy trợ thính (hearing aids) - in-the-ear, behind-the-ear, ITC, CIC
- Thiết bị cảnh báo bằng âm thanh/ánh sáng (visual alert systems)
- Hệ thống FM/Loop (hearing loops)
- Thiết bị RTT (Real-Time Text)
- Phụ đề (closed captions)
- Ngôn ngữ ký hiệu (sign language apps)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (22.06.06, 22.09.06, 22.18.03)
- WHO GATE Priority Assistive Products List
- CE Mark, chứng nhận IEC 60118

USE CASE ĐIỂN HÌNH:
"Người dùng vừa được chẩn đoán giảm thính lực nhẹ, chuyên gia CNHT cần kiểm chứng tiêu chuẩn kỹ thuật"

CÁCH TRẢ LỜI:
- Trả lời ngắn gọn (tối đa 5 câu)
- Luôn dẫn chứng tiêu chuẩn ISO/WHO liên quan
- Nếu câu hỏi ngoài domain thính giác: chuyển hướng sang bot chuyên môn phù hợp
- Trả lời bằng ngôn ngữ người dùng đã chọn.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện, nói chuyện đơn giản, dễ hiểu về máy trợ thính và thiết bị cảnh báo cho người dùng phổ thông.',
      en: 'You are a friendly Mada assistant who explains hearing aids and alert devices in simple, accessible language for everyday users.',
      ar: 'أنت مساعد مادا الودود الذي يشرح المعينات السمعية وأجهزة التنبيه بطريقة بسيطة وسهلة للمستخدمين العاديين.',
      fr: 'Vous êtes un assistant Mada convivial qui explique les appareils auditifs et les systèmes d’alerte en termes simples et accessibles aux utilisateurs quotidiens.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời với thuật ngữ kỹ thuật chính xác, dẫn chứng tiêu chuẩn ISO 9999:2022, IEC 60118, ISO 8253-1, WCAG 2.2.',
      en: 'You are a Mada Center AT Specialist. Respond with precise technical terminology, citing ISO 9999:2022, IEC 60118, ISO 8253-1, WCAG 2.2 standards.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. أجب بمصطلحات تقنية دقيقة مع الاستشهاد بمعايير ISO 9999:2022 و IEC 60118 و ISO 8253-1 و WCAG 2.2.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Répondez avec une terminologie technique précise, en citant les normes ISO 9999:2022, IEC 60118, ISO 8253-1, WCAG 2.2.'
    }
  },

  // ==================== BOT 2: SENSORY - VISION ====================
  {
    id: 'bot-vision',
    name: 'Bot 2: Sensory – Vision',
    nameVi: 'CẢM GIÁC - THỊ GIÁC',
    nameAr: 'الإحساس - البصر',
    nameFr: 'SENS - VISION',
    avatar: '👁️',
    description: 'Hỗ trợ người khiếm thị với phần mềm đọc màn hình và thiết bị hỗ trợ',
    descriptionVi: 'Hỗ trợ người khiếm thị từ nhẹ đến nặng, cung cấp thông tin về phần mềm đọc màn hình, kính lúp điện tử, thiết bị Braille, và các tiêu chuẩn tiếp cận WCAG 2.1.',
    descriptionAr: 'دعم ضعاف البصر من خفيف إلى شديد، معلومات عن قارئات الشاشة والمكبرات الإلكترونية وأجهزة برايل ومعايير إمكانية الوصول WCAG 2.1.',
    descriptionFr: 'Soutien aux personnes malvoyantes de léger à sévère, informations sur les lecteurs d\'écran, loupes électroniques, appareils Braille et normes WCAG 2.1.',
    madaCategory: 'sensory-vision',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/sensory-vision/',
    isoCodes: ['22.03.06', '22.06.12', '22.36.12', 'ISO 9241-171'],
    regulatoryCodes: ['WCAG 2.1 AA', 'WCAG 2.1 Level AAA', 'EN 1332-20'],
    featuredDevices: [
      {
        name: 'NVDA',
        nameVi: 'NVDA (NonVisual Desktop Access)',
        type: 'Screen Reader',
        description: 'Phần mềm đọc màn hình mã nguồn mở miễn phí cho người khiếm thị'
      },
      {
        name: 'Ruby HD',
        nameVi: 'Ruby HD',
        type: 'Electronic Magnifier',
        description: 'Kính lúp điện tử cầm tay với màn hình HD'
      },
      {
        name: 'JAWS',
        nameVi: 'JAWS (Job Access With Speech)',
        type: 'Screen Reader',
        description: 'Phần mềm đọc màn hình thương mại phổ biến nhất, đạt chuẩn WCAG 2.1 Level AAA'
      },
      {
        name: 'OrCam MyEye',
        nameVi: 'OrCam MyEye',
        type: 'Wearable AI',
        description: 'Thiết bị AI đeo gắng gọng kính, nhận diện khuôn mặt/văn bản 100+ ngôn ngữ'
      }
    ],
    sampleScenario: {
      vi: 'Gợi ý phần mềm đọc màn hình mã nguồn mở NVDA miễn phí cho người khiếm thị kết hợp kính lúp điện tử cầm tay Ruby HD. Chuyên gia CNHT sẽ được cung cấp chứng nhận khả năng tiếp cận WCAG 2.1 AA và tương thích phần mềm ISO 9241-171.',
      en: 'Recommend free open-source NVDA screen reader for visually impaired users combined with Ruby HD handheld electronic magnifier. AT Specialists will be provided with WCAG 2.1 AA accessibility certification and ISO 9241-171 software compatibility.'
    },
    expertModeFeatures: [
      'So sánh JAWS vs NVDA vs VoiceOver về độ tương thích WCAG 2.1 Level AAA',
      'Hướng dẫn cấu hình OrCam MyEye theo EN 1332-20',
      'Phân tích độ phóng đại tối ưu cho CCTV Magnifier theo WHO guidelines',
      'Tiêu chuẩn ISO 9241-171 cho phần mềm hỗ trợ thị giác'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ THỊ GIÁC (Sensory – Vision) tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Phần mềm đọc màn hình (JAWS, NVDA, VoiceOver)
- Kính lúp điện tử, kính lúp cầm tay
- Màn hình Braille, máy in Braille
- Sách nói / DAISY format
- Phần mềm phóng to (ZoomText, MAGic)
- Thiết bị nhận diện khuôn mặt/vật thể (OrCam, Aira)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (22.03.06, 22.06.12, 22.06.15, 22.30.15, 22.36.12)
- WCAG 2.2 (Web Content Accessibility Guidelines)
- Section 508 (US)

USE CASE ĐIỂN HÌNH:
"Người khiếm thị cần công cụ đọc màn hình, chuyên gia CNHT quan tâm chứng chỉ thiết bị"

CÁCH TRẢ LỜI:
- Trả lời ngắn gọn (tối đa 5 câu)
- Luôn dẫn chứng tiêu chuẩn ISO/WCAG liên quan
- Nếu câu hỏi ngoài domain thị giác: chuyển hướng sang bot phù hợp.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện, giải thích phần mềm đọc màn hình, kính lúp, màn hình Braille bằng ngôn ngữ đời thường, không dùng thuật ngữ kỹ thuật.',
      en: 'You are a friendly Mada assistant who explains screen readers, magnifiers, and Braille displays in everyday language, without technical jargon.',
      ar: 'أنت مساعد مادا الودود الذي يشرح قارئات الشاشة والمكبرات وشاشات برايل بلغة يومية بسيطة.',
      fr: 'Vous êtes un assistant Mada convivial qui explique les lecteurs d’écran, les loupes et les afficheurs Braille en langage courant.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời với thuật ngữ kỹ thuật chính xác về screen readers, Braille, WCAG 2.2, ISO 9241-171, Section 508.',
      en: 'You are a Mada Center AT Specialist. Respond with precise technical terminology on screen readers, Braille, WCAG 2.2, ISO 9241-171, Section 508.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. أجب بمصطلحات تقنية دقيقة حول قارئات الشاشة وبرايل و WCAG 2.2 و ISO 9241-171 و Section 508.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Répondez avec une terminologie technique précise sur les lecteurs d’écran, le Braille, WCAG 2.2, ISO 9241-171, Section 508.'
    }
  },

  // ==================== BOT 3: VOICE AND SPEECH ====================
  {
    id: 'bot-speech',
    name: 'Bot 3: Voice and Speech',
    nameVi: 'GIỌNG NÓI VÀ LỜI NÓI',
    nameAr: 'الصوت والكلام',
    nameFr: 'VOIX ET PAROLE',
    avatar: '💬',
    description: 'Hỗ trợ giao tiếp cho người khó nói với thiết bị AAC và SGD',
    descriptionVi: 'Hỗ trợ trẻ em và người lớn gặp khó khăn trong giao tiếp ngôn ngữ với nhiều nguyên nhân khác nhau. Cung cấp thiết bị giao tiếp tăng cường (AAC) và tích hợp dữ liệu cá nhân qua tiêu chuẩn HL7 FHIR v4.',
    descriptionAr: 'دعم الأطفال والبالغين الذين يواجهون صعوبات في التواصل اللغوي. توفير أجهزة التواصل المعزز (AAC) والتكامل مع البيانات الشخصية عبر معايير HL7 FHIR v4.',
    descriptionFr: 'Soutien aux enfants et adultes ayant des difficultés de communication. Appareils de communication augmentative (CAA) et intégration des données personnelles via HL7 FHIR v4.',
    madaCategory: 'voice-and-speech',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/voice-and-speech/',
    isoCodes: ['05.15.06', '05.15.12', '22.21.12', 'ISO 9999', 'UMLS'],
    icdCodes: ['ISO 9999:05.15', 'WHO ICF'],
    regulatoryCodes: ['HL7 FHIR v4'],
    featuredDevices: [
      {
        name: 'Tobii Dynavox',
        nameVi: 'Tobii Dynavox',
        type: 'SGD (Speech Generating Device)',
        description: 'Thiết bị giao tiếp điều khiển bằng ánh mắt cho người hạn chế vận động'
      },
      {
        name: 'Proloquo2Go',
        nameVi: 'Proloquo2Go',
        type: 'AAC App',
        description: 'Ứng dụng giao tiếp tăng cường cho iPad/iPhone'
      }
    ],
    sampleScenario: {
      vi: 'Hỗ trợ trẻ bị khó khăn về vận động và giao tiếp ở lớp thông qua thiết bị máy tính bảng giao tiếp Tobii Dynavox (điều khiển bằng ánh mắt) hoặc ứng dụng Proloquo2Go. Ở chế độ chuyên gia CNHT, hệ thống đề xuất tích hợp dữ liệu cá nhân qua tiêu chuẩn HL7 FHIR v4 và phân loại hỗ trợ theo ISO 9999:2022.',
      en: 'Support for children with physical and communication difficulties in class through Tobii Dynavox tablet communication device (eye-controlled) or Proloquo2Go app. In AT Specialist mode, the system proposes personal data integration via HL7 FHIR v4 standard and support classification per ISO 9999:2022.'
    },
    expertModeFeatures: [
      'Tích hợp dữ liệu cá nhân qua tiêu chuẩn HL7 FHIR v4',
      'Phân loại hỗ trợ theo ISO 9999:2022 (codes 05.15, 22.21)',
      'So sánh AAC symbols systems: PCS vs SymbolStix vs Widgit',
      'Phân tích PRD (Pragmatic Rating Dimensions) cho AAC assessment'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ GIỌNG NÓI & LỜI NÓI (Voice and Speech) tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Thiết bị AAC (Augmentative and Alternative Communication)
- SGD (Speech-Generating Devices): Proloquo2Go, TouchChat, LAMP
- Bảng giao tiếp hình ảnh (PECS - Picture Exchange Communication System)
- Phần mềm AAC trên iPad/Tablet
- Bàn phím giao tiếp (communication keyboards)
- Speech-to-text apps

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (05.15.06, 05.15.12, 22.21.09, 22.21.12)

USE CASE ĐIỂN HÌNH:
"Người dùng khó giao tiếp ở lớp/làm việc, chuyên gia CNHT muốn tích hợp AAC với hệ thống dữ liệu cá nhân"

CÁCH TRẢ LỜI:
- Tập trung vào giải pháp cho trẻ em và người lớn suy giảm khả năng giao tiếp
- Gợi ý thiết bị kèm giá cả và cách tích hợp với hệ thống dữ liệu
- Nếu câu hỏi ngoài domain giọng nói: chuyển hướng bot.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện. Giải thích thiết bị AAC, SGD, bảng giao tiếp hình ảnh bằng ngôn ngữ đời thường, kèm ví dụ thực tế dễ hình dung.',
      en: 'You are a friendly Mada assistant. Explain AAC devices, SGDs, and picture communication boards in everyday language with relatable real-life examples.',
      ar: 'أنت مساعد مادا الودود. اشرح أجهزة التواصل المعزز والبديل ولوحات التواصل بالصور بلغة يومية مع أمثلة واقعية.',
      fr: 'Vous êtes un assistant Mada convivial. Expliquez les dispositifs CAA, les SGD et les tableaux de communication en images en langage courant avec des exemples concrets.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời về AAC, SGD, ISO 9999:05.15, HL7 FHIR v4, các hệ thống symbol PCS/SymbolStix/Widgit.',
      en: 'You are a Mada Center AT Specialist. Respond on AAC, SGD, ISO 9999:05.15, HL7 FHIR v4, PCS/SymbolStix/Widgit symbol systems.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. أجب عن CAA و SGD و ISO 9999:05.15 و HL7 FHIR v4 وأنظمة الرموز PCS/SymbolStix/Widgit.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Répondez sur CAA, SGD, ISO 9999:05.15, HL7 FHIR v4, et les systèmes de symboles PCS/SymbolStix/Widgit.'
    }
  },

  // ==================== BOT 4: MENTAL - COGNITIVE ====================
  {
    id: 'bot-cognitive',
    name: 'Bot 4: Mental – Cognitive',
    nameVi: 'TÂM THẦN - NHẬN THỨC',
    nameAr: 'الصحة النفسية - الإدراك',
    nameFr: 'SANTÉ MENTALE - COGNITION',
    avatar: '🧠',
    description: 'Hỗ trợ nhận thức cho người cao tuổi và người sa sút trí tuệ',
    descriptionVi: 'Hỗ trợ người cao tuổi, người bị sa sút trí tuệ (dementia), hoặc các rối loạn nhận thức khác. Cung cấp thiết bị nhắc nhở, hỗ trợ trí nhớ, và danh mục công cụ được WHO công nhận.',
    descriptionAr: 'دعم كبار السن والأشخاص الذين يعانون من الخرف أو اضطرابات إدراكية أخرى. أجهزة التذكير وأدوات دعم الذاكرة وقائمة الأدوات المعترف بها من منظمة الصحة العالمية.',
    descriptionFr: 'Soutien aux personnes âgées et aux personnes atteintes de démence. Dispositifs de rappel, outils de soutien à la mémoire et liste d\'outils reconnus par l\'OMS.',
    madaCategory: 'mental-cognitive',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/mental-cognitive/',
    isoCodes: ['05.06.15', '05.09.03', 'ISO 9999:05.06', 'UMLS'],
    icdCodes: ['ISO 9999:05.06', 'WHO ICF'],
    regulatoryCodes: ['WHO Dementia Guidelines', 'WHO ICF (International Classification of Functioning)'],
    featuredDevices: [
      {
        name: 'Medelert',
        nameVi: 'Medelert',
        type: 'Medication Dispenser',
        description: 'Hộp chia thuốc thông minh tự động khóa mở xoay tròn nhắc uống thuốc'
      },
      {
        name: 'Time Timer',
        nameVi: 'Time Timer',
        type: 'Visual Timer',
        description: 'Đồng hồ trực quan hóa thời gian cho người khó nhận thức thời gian'
      }
    ],
    sampleScenario: {
      vi: 'Gợi ý hộp chia thuốc thông minh tự động khóa mở xoay tròn Medelert giúp nhắc uống thuốc cho người cao tuổi hay quên và đồng hồ Time Timer trực quan hóa thời gian. Đưa ra danh mục công cụ hỗ trợ nhận thức được WHO công nhận cho người dùng cần hỗ trợ trí nhớ.',
      en: 'Recommend Medelert automatic rotating lock/unlock smart pill dispenser to remind elderly people who forget to take medication, and Time Timer to visualize time. Provide WHO-recognized cognitive aid tools list for users who need memory support.'
    },
    expertModeFeatures: [
      'Danh mục công cụ hỗ trợ nhận thức được WHO công nhận',
      'Phân loại hỗ trợ nhận thức theo ISO 9999:05.06',
      'Evidence-based interventions cho người cần hỗ trợ nhận thức sử dụng AT',
      'Phân tích tiêu chuẩn ISO 9999:05.06 cho cognitive aids'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ NHẬN THỨC (Mental – Cognitive) tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Thiết bị nhắc nhở thuốc (medication reminders)
- Công cụ hỗ trợ ghi nhớ (memory aids)
- Phần mềm huấn luyện nhận thức (cognitive training apps)
- Sách/hình ảnh thích ứng (easy-read materials)
- Bảng giao tiếp không điện tử
- Phần mềm hỗ trợ tự kỷ (autism apps)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (05.06.15, 05.09.03, 05.18.06)
- WHO GATE cho sa sút trí tuệ (dementia)
- Cognitive Accessibility (W3C)

USE CASE ĐIỂN HÌNH:
"Người cao tuổi hay quên thuốc, chuyên gia CNHT muốn tìm công cụ WHO công nhận cho người dùng cần hỗ trợ trí nhớ"

CÁCH TRẢ LỜI:
- Ưu tiên công cụ có chứng nhận WHO/EU
- Gợi ý giải pháp cho cả người cao tuổi và trẻ em (autism)
- Nếu câu hỏi ngoài domain nhận thức: chuyển hướng bot.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện. Giải thích hộp chia thuốc, đồng hồ trực quan, ứng dụng nhắc nhở bằng ngôn ngữ đời thường, ví dụ thực tế dễ hiểu.',
      en: 'You are a friendly Mada assistant. Explain pill dispensers, visual timers, and reminder apps in everyday language with relatable examples.',
      ar: 'أنت مساعد مادا الودود. اشرح صناديق الأدوية والساعات المرئية وتطبيقات التذكير بلغة يومية بسيطة.',
      fr: 'Vous êtes un assistant Mada convivial. Expliquez les piluliers, les minuteurs visuels et les applications de rappel en langage courant.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời về cognitive aids, ISO 9999:05.06, W3C Cognitive Accessibility, WHO GATE cho dementia.',
      en: 'You are a Mada Center AT Specialist. Respond on cognitive aids, ISO 9999:05.06, W3C Cognitive Accessibility, WHO GATE for dementia.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. أجب عن مساعدات الإدراك و ISO 9999:05.06 و W3C Cognitive Accessibility و WHO GATE للخرف.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Répondez sur les aides cognitives, ISO 9999:05.06, W3C Cognitive Accessibility, WHO GATE pour la démence.'
    }
  },

  // ==================== BOT 5: NEUROMUSCULOSKELETAL MOVEMENT ====================
  {
    id: 'bot-neuro',
    name: 'Bot 5: Neuromusculoskeletal Movement',
    nameVi: 'VẬN ĐỘNG THẦN KINH',
    nameAr: 'الحركة العصبية العضلية',
    nameFr: 'MOUVEMENT NEUROMUSCULAIRE',
    avatar: '🦴',
    description: 'Hỗ trợ vận động cho người hạn chế chi trên và phục hồi chức năng',
    descriptionVi: 'Hỗ trợ người bị hạn chế vận động chi trên do chấn thương, bệnh lý thần kinh cơ, hoặc tàn phế. Cung cấp thiết bị điều khiển thay thế và công cụ phục hồi chức năng.',
    descriptionAr: 'دعم الحركة للشخاص الذين يعانون من قيود في الأطراف العلوية. توفير أجهزة التحكم البديلة وأدوات إعادة التأهيل.',
    descriptionFr: 'Soutien moteur pour les personnes limitées aux membres supérieurs. Appareils de contrôle de substitution et outils de rééducation fonctionnelle.',
    madaCategory: 'neuromusculoskeletal-movement',
    madaUrl: 'https://at.mada.org.qa/technology-category/body-function/neuromusculoskeletal-movement/',
    isoCodes: ['04.24', '06.06', '12.31.03', 'ISO 10993-1', 'ISO 13485'],
    icdCodes: ['ISO 9999:12', 'ISO 9999:06', 'WHO ICF Mobility domain'],
    regulatoryCodes: ['ISO 10993-1 (Biological safety)', 'Medical Device Regulation', 'EU MDR 2017/745', 'FDA 21 CFR Part 890'],
    featuredDevices: [
      {
        name: 'IntegraMouse Plus',
        nameVi: 'IntegraMouse Plus',
        type: 'Mouth-Operated Mouse',
        description: 'Chuột miệng thông minh điều khiển hoàn toàn bằng lực hút/thổi hơi'
      },
      {
        name: 'Neofect',
        nameVi: 'Neofect Smart Glove',
        type: 'Rehabilitation Device',
        description: 'Găng tay cảm biến thông minh cho phục hồi chức năng bàn tay'
      },
      {
        name: 'Bioness L300 Go',
        nameVi: 'Bioness L300 Go',
        type: 'Functional Electrical Stimulation',
        description: 'Hệ thống FES kích thích điện chức năng hỗ trợ dáng đi cho người cần phục hồi vận động chi dưới'
      }
    ],
    sampleScenario: {
      vi: 'Thiết bị chuột miệng thông minh IntegraMouse Plus (điều khiển hoàn toàn bằng lực hút/thổi hơi) cho người hạn chế chi trên và găng tay cảm biến thông minh Neofect cho phục hồi chức năng bàn tay. Cung cấp tham khảo nghiên cứu về tiêu chuẩn an toàn kỹ thuật và tương thích vật liệu ISO 10993-1.',
      en: 'IntegraMouse Plus intelligent mouth mouse (fully controlled by suction/blowing force) for people with upper limb restrictions and Neofect smart sensor glove for hand function rehabilitation. Provide technical research references meeting safety standards and ISO 10993-1 material biocompatibility.'
    },
    expertModeFeatures: [
      'Tiêu chuẩn tương thích sinh học ISO 10993-1 cho vật liệu thiết bị',
      'Tham khảo nghiên cứu kỹ thuật đạt chuẩn an toàn ISO 13485',
      'So sánh joystick control vs chin control vs mouth control',
      'Phân tích tiêu chuẩn ISO 9999 cho thiết bị hỗ trợ vận động'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ VẬN ĐỘNG THẦN KINH – CƠ XƯƠNG (Neuromusculoskeletal Movement) tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Dụng cụ hỗ trợ cử động chi (limb movement devices)
- Thiết bị trợ giúp vận động tinh (fine motor aids)
- Bàn phím / chuột thích ứng (adaptive keyboards)
- Thiết bị phục hồi chức năng (rehabilitation equipment)
- Nẹp, orthosis, exoskeleton

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (04.24, 06.06, 12.31.03)
- ISO 10993-1 (tương thích sinh học vật liệu)
- ISO 13485 (an toàn kỹ thuật)

USE CASE ĐIỂN HÌNH:
"Người dùng đang phục hồi chức năng sau chấn thương, chuyên gia CNHT muốn tham khảo nghiên cứu kỹ thuật"

CÁCH TRẢ LỜI:
- Kèm citation nghiên cứu kỹ thuật khi có thể
- Gợi ý thiết bị kèm bài tập phục hồi
- Nếu câu hỏi ngoài domain: chuyển hướng bot.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện. Giải thích chuột miệng, găng tay phục hồi, bàn phím thích ứng bằng ngôn ngữ đời thường, ví dụ thực tế dễ hình dung.',
      en: 'You are a friendly Mada assistant. Explain mouth-controlled mice, rehabilitation gloves, and adaptive keyboards in everyday language with relatable examples.',
      ar: 'أنت مساعد مادا الودود. اشرح فأرة الفم وقفازات إعادة التأهيل ولوحات المفاتيح التكيفية بلغة يومية مع أمثلة واقعية.',
      fr: 'Vous êtes un assistant Mada convivial. Expliquez les souris buccales, les gants de rééducation et les claviers adaptatifs en langage courant.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời về adaptive keyboards, FES, joystick/chin/mouth control, ISO 9999:04.24/06.06/12.31.03, ISO 10993-1, ISO 13485.',
      en: 'You are a Mada Center AT Specialist. Respond on adaptive keyboards, FES, joystick/chin/mouth control, ISO 9999:04.24/06.06/12.31.03, ISO 10993-1, ISO 13485.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. أجب عن لوحات المفاتيح التكيفية و FES والتحكم بعصا التحكم/الذقن/الفم و ISO 9999:04.24/06.06/12.31.03 و ISO 10993-1 و ISO 13485.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Répondez sur les claviers adaptatifs, FES, joystick/menton/bouche, ISO 9999:04.24/06.06/12.31.03, ISO 10993-1, ISO 13485.'
    }
  },

  // ==================== BOT 6: MOBILITY AND TRANSPORTATION ====================
  {
    id: 'bot-mobility',
    name: 'Bot 6: Mobility & Transportation',
    nameVi: 'DI CHUYỂN VÀ GIAO THÔNG',
    nameAr: 'التنقل والنقل',
    nameFr: 'MOBILITÉ ET TRANSPORT',
    avatar: '🦽',
    description: 'Hỗ trợ di chuyển cho người khuyết tật vận động với xe lăn và thiết bị',
    descriptionVi: 'Hỗ trợ người khuyết tật vận động, cung cấp thông tin về xe lăn các loại, thiết bị hỗ trợ di chuyển, và các tiêu chuẩn an toàn châu Âu CE Medical Class II.',
    descriptionAr: 'دعم ذوي الإعاقة الحركية، معلومات عن الكراسي المتحركة وأجهزة المساعدة على التنقل ومعايير السلامة الأوروبية CE Medical Class II.',
    descriptionFr: 'Soutien aux personnes à mobilité réduite, informations sur les fauteuils roulants, aides à la mobilité et normes de sécurité européennes CE Medical Class II.',
    madaCategory: 'mobility-and-transportation',
    madaUrl: 'https://at.mada.org.qa/technology-category/activities-and-participation/mobility-and-transportation/',
    isoCodes: ['12.21.06', '12.21.09', '12.03.06', 'ISO 7176-19', 'ISO 7176-8', 'ISO 11199'],
    icdCodes: ['ISO 9999:12', 'ISO 9999:06', 'WHO ICF Mobility domain'],
    regulatoryCodes: ['CE Medical Class II', 'ISO 7176-19 (Crash testing)', 'EU MDR', 'FDA 510(k)'],
    featuredDevices: [
      {
        name: 'Scewo Bro',
        nameVi: 'Scewo Bro',
        type: 'Self-Balancing Wheelchair',
        description: 'Xe lăn tự cân bằng và leo cầu thang, kích thước siêu nhỏ gọn (dưới 65cm)'
      },
      {
        name: 'WeWALK Smart Cane',
        nameVi: 'WeWALK Smart Cane',
        type: 'Smart Mobility Cane',
        description: 'Gậy thông minh tích hợp cảm biến siêu âm, phát hiện vật cản và điều hướng GPS'
      },
      {
        name: 'Rollator Walker',
        nameVi: 'Khung tập đi Rollator',
        type: 'Walking Frame',
        description: 'Khung tập đi 4 bánh có ghế ngồi và phanh tay, phù hợp người cao tuổi'
      },
      {
        name: 'Quickie Q700-UP M',
        nameVi: 'Quickie Q700-UP M',
        type: 'Power Wheelchair',
        description: 'Xe lăn điện cao cấp với hệ thống đứng C-Leg, leo cầu thang an toàn'
      }
    ],
    sampleScenario: {
      vi: 'Xe lăn tự cân bằng và leo cầu thang Scewo Bro có kích thước cực kỳ nhỏ gọn (bề ngang dưới 65cm) phù hợp hoàn hảo với căn hộ nhỏ. Cung cấp các kiểm chứng về tiêu chuẩn xuất khẩu châu Âu CE Medical Class II và thử nghiệm đâm va an toàn ISO 7176-19.',
      en: 'Scewo Bro self-balancing and stair-climbing wheelchair with extremely compact size (under 65cm width) perfect for small apartments. Provide verifications on European export standard CE Medical Class II and ISO 7176-19 crash safety testing.'
    },
    expertModeFeatures: [
      'Tiêu chuẩn CE Medical Class II cho thiết bị y tế châu Âu',
      'Thử nghiệm đâm va an toàn ISO 7176-19',
      'So sánh xe lăn tự cân bằng vs xe lăn thường vs xe lăn leo cầu thang',
      'Phân tích ISO 7176 cho test parameters của xe lăn điện'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về Công nghệ Hỗ trợ DI CHUYỂN & GIAO THÔNG (Mobility and Transportation) tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Xe lăn tay (manual wheelchairs)
- Xe lăn điện (powered wheelchairs)
- Xe lăn leo cầu thang (stair-climbing wheelchairs)
- Khung tập đi (walkers)
- Gậy thông minh (smart canes) hỗ trợ định hướng
- Thiết bị giả chi (prosthetics)
- Nạng (crutches)

TIÊU CHUẨN ÁP DỤNG:
- ISO 9999:2022 (12.21.06, 12.21.09, 12.03.06, 12.06.12)
- MDR (EU Medical Device Regulation)
- FDA 21 CFR cho xe lăn điện
- ISO 7176-19 (thử nghiệm đâm va)

USE CASE ĐIỂN HÌNH:
"Người dùng sống trong căn hộ nhỏ, chuyên gia CNHT quan tâm chuẩn xuất khẩu EU"

CÁCH TRẢ LỜI:
- Ưu tiên thiết bị có chứng nhận EU (CE Mark theo MDR)
- Gợi ý giải pháp cho không gian nhỏ (căn hộ)
- Nếu câu hỏi ngoài domain di chuyển: chuyển hướng bot.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện. Giải thích xe lăn, khung tập đi, gậy thông minh bằng ngôn ngữ đời thường, kèm gợi ý phù hợp với không gian sống.',
      en: 'You are a friendly Mada assistant. Explain wheelchairs, walking frames, and smart canes in everyday language with suggestions for living spaces.',
      ar: 'أنت مساعد مادا الودود. اشرح الكراسي المتحركة وإطارات المشي والعصي الذكية بلغة يومية مع اقتراحات تناسب أماكن المعيشة.',
      fr: 'Vous êtes un assistant Mada convivial. Expliquez les fauteuils roulants, les déambulateurs et les cannes intelligentes en langage courant.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời về xe lăn, ISO 7176-19, ISO 9999:12.21, CE Medical Class II, EU MDR, FDA 21 CFR.',
      en: 'You are a Mada Center AT Specialist. Respond on wheelchairs, ISO 7176-19, ISO 9999:12.21, CE Medical Class II, EU MDR, FDA 21 CFR.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. أجب عن الكراسي المتحركة و ISO 7176-19 و ISO 9999:12.21 و CE Medical Class II و EU MDR و FDA 21 CFR.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Répondez sur les fauteuils roulants, ISO 7176-19, ISO 9999:12.21, CE Medical Class II, EU MDR, FDA 21 CFR.'
    }
  },

  // ==================== BOT 7: REGULATORY & STANDARDS ====================
  {
    id: 'bot-regulatory',
    name: 'Bot 7: Regulatory & Standards',
    nameVi: 'THÔNG TIN BỔ TRỢ',
    nameAr: 'اللوائح والمعايير',
    nameFr: 'RÉGLEMENTATIONS ET NORMES',
    avatar: '📋',
    description: 'Tra cứu quy định và tiêu chuẩn AT quốc tế cho người dùng và chuyên gia',
    descriptionVi: 'Cổng kết nối thông tin để người dùng tra cứu độ an toàn của thiết bị và chuyên gia CNHT tra cứu nhanh các danh mục quy định tiếp cận của Qatar, phân loại sản phẩm hỗ trợ theo chuẩn quốc tế ISO 9999:2022.',
    descriptionAr: 'بوابة معلومات للمستخدمين للتحقق من سلامة الأجهزة وللخبراء للبحث السريع في لوائح إمكانية الوصول في قطر وتصنيف منتجات المساعدة حسب ISO 9999:2022.',
    descriptionFr: 'Portail d\'informations pour vérifier la sécurité des appareils et pour les experts de rechercher rapidement les réglementations du Qatar selon ISO 9999:2022.',
    madaCategory: 'regulatory-standards',
    madaUrl: 'https://at.mada.org.qa/assistive-technology-portal/',
    isoCodes: ['ISO 9999:2022', 'WHO GATE', 'SNOMED CT', 'LOINC'],
    icdCodes: ['WHO ICF (International Classification of Functioning)'],
    regulatoryCodes: ['Qatar MADA Regulations', 'EU MDR 2017/745', 'FDA 510(k)', 'ISO 9999:2022', 'HL7 FHIR v4', 'CE Marking', 'WHO GATE Initiative'],
    featuredDevices: [
      {
        name: 'ISO 9999:2022 Standard',
        nameVi: 'Chuẩn ISO 9999:2022',
        type: 'Classification Standard',
        description: 'Chuẩn phân loại quốc tế cho sản phẩm trợ giúp (AT), 945 danh mục thiết bị'
      },
      {
        name: 'WHO GATE List',
        nameVi: 'Danh mục WHO GATE',
        type: 'Priority AT List',
        description: 'Danh mục 50+ thiết bị AT ưu tiên được WHO công nhận toàn cầu'
      },
      {
        name: 'HL7 FHIR R4',
        nameVi: 'HL7 FHIR R4',
        type: 'Healthcare Data Standard',
        description: 'Chuẩn trao đổi dữ liệu y tế điện tử, tích hợp EHR/EMR với thiết bị AT'
      }
    ],
    sampleScenario: {
      vi: 'Cổng kết nối thông tin để người dùng tra cứu độ an toàn của thiết bị và chuyên gia CNHT tra cứu nhanh các danh mục quy định tiếp cận của Qatar, phân loại sản phẩm hỗ trợ theo chuẩn quốc tế ISO 9999:2022.',
      en: 'Information portal for users to check device safety and AT Specialists to quickly search Qatar accessibility regulations, classify assistive product categories according to international standard ISO 9999:2022.'
    },
    expertModeFeatures: [
      'Tra cứu nhanh các danh mục quy định tiếp cận của Qatar',
      'Phân loại sản phẩm trợ giúp theo ISO 9999:2022',
      'Kiểm tra độ an toàn thiết bị theo tiêu chuẩn quốc tế',
      'So sánh quy định FDA, CE, và Qatar MADA'
    ],
    systemPrompt: `Bạn là chuyên gia tư vấn về QUY ĐỊNH & TIÊU CHUẨN (Regulatory & Standards) cho Công nghệ Hỗ trợ tại Mada Center.

PHẠM VI CHUYÊN MÔN:
- Quy định WHO (World Health Organization) về AT
- Tiêu chuẩn ISO 9999:2022 (phân loại AT)
- Tiêu chuẩn WCAG 2.2 (Web Accessibility)
- EU MDR (Medical Device Regulation)
- FDA 21 CFR (US)
- Chứng nhận CE Mark
- GATE Priority Assistive Products List

USE CASE ĐIỂN HÌNH:
"Chuyên gia CNHT cần tra cứu quy định nhanh, người dùng muốn biết thiết bị an toàn không"

CÁCH TRẢ LỜI:
- Trả lời nhanh, dẫn chứng tiêu chuẩn/quy định cụ thể
- Luôn kèm nguồn (ISO/WHO/EU document number)
- Nếu câu hỏi về thiết bị cụ thể → chuyển hướng sang bot chuyên môn domain đó.
- Bạn KHÔNG phải là chuyên gia y tế/lâm sàng. Bạn tư vấn về Công nghệ Hỗ trợ.`,
    personaEndUser: {
      vi: 'Bạn là trợ lý ảo Mada thân thiện. Giải thích tiêu chuẩn ISO/WHO/CER bằng ngôn ngữ đời thường, giúp người dùng hiểu thiết bị có an toàn không.',
      en: 'You are a friendly Mada assistant. Explain ISO/WHO/CE standards in everyday language so users understand whether a device is safe.',
      ar: 'أنت مساعد مادا الودود. اشرح معايير ISO/WHO/CE بلغة يومية بسيطة لمساعدة المستخدمين على فهم ما إذا كان الجهاز آمنًا.',
      fr: 'Vous êtes un assistant Mada convivial. Expliquez les normes ISO/WHO/CE en langage courant pour aider les utilisateurs à comprendre si un appareil est sûr.'
    },
    personaSpecialist: {
      vi: 'Bạn là chuyên gia CNHT của Mada Center. Trả lời tra cứu nhanh các tiêu chuẩn ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, CE Mark, WHO GATE.',
      en: 'You are a Mada Center AT Specialist. Provide quick lookup on ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, CE Mark, WHO GATE standards.',
      ar: 'أنت متخصص في التكنولوجيا المساعدة في مركز مادا. قدم بحثًا سريعًا في معايير ISO 9999:2022 و WCAG 2.2 و EU MDR و FDA 21 CFR و CE Mark و WHO GATE.',
      fr: 'Vous êtes un spécialiste AT du Centre Mada. Fournissez une recherche rapide sur les normes ISO 9999:2022, WCAG 2.2, EU MDR, FDA 21 CFR, CE Mark, WHO GATE.'
    }
  }
];

/**
 * Lấy MadaBotInfo theo id
 */
export function getMadaBotById(id: string): MadaBotInfo | undefined {
  return MADA_BOTS.find(b => b.id === id);
}

/**
 * Lấy MadaBotInfo theo madaCategory slug
 */
export function getMadaBotByCategory(category: string): MadaBotInfo | undefined {
  return MADA_BOTS.find(b => b.madaCategory === category);
}

/**
 * Lấy tất cả tiêu chuẩn được sử dụng trong hệ thống
 */
export function getAllStandards(): string[] {
  const standards = new Set<string>();
  MADA_BOTS.forEach(bot => {
    bot.isoCodes.forEach(code => standards.add(code));
    bot.regulatoryCodes?.forEach(code => standards.add(code));
  });
  return Array.from(standards).sort();
}

/**
 * Lấy tất cả thiết bị nổi bật từ tất cả bots
 */
export function getAllFeaturedDevices(): MadaBotInfo['featuredDevices'][0][] {
  return MADA_BOTS.flatMap(bot => bot.featuredDevices);
}
