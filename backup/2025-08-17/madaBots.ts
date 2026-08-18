/**
 * 7 Bot MADA - Mapping frontend
 * Dùng để hiển thị agent list, badge category, và import seed.
 * Cập nhật: Thêm kịch bản mẫu, thiết bị cụ thể, và tiêu chuẩn đầy đủ
 */

export interface MadaBotInfo {
  id: string;           // agent id (cũng là botId)
  name: string;
  nameVi: string;
  avatar: string;
  description: string;
  descriptionVi: string;       // Mô tả tiếng Việt chi tiết hơn
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
}

export const MADA_BOTS: MadaBotInfo[] = [
  // ==================== BOT 1: SENSORY - HEARING ====================
  {
    id: 'bot-hearing',
    name: 'Bot 1: Sensory – Hearing',
    nameVi: 'Trợ lý Thính giác',
    avatar: '👂',
    description: 'Hỗ trợ người suy giảm thính lực với thiết bị trợ thính và cảnh báo',
    descriptionVi: 'Hỗ trợ người dùng bị giảm thính lực nhẹ đến nặng, cung cấp thông tin về máy trợ thính, thiết bị cảnh báo bằng ánh sáng/xúc giác, hệ thống FM, và các tiêu chuẩn kiểm chứng an toàn kỹ thuật.',
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
      vi: 'Hỗ trợ người dùng bị giảm thính lực nhẹ với thiết bị trợ thính Phonak Lyric ẩn sâu trong tai hoặc thiết bị cảnh báo bằng ánh sáng/xúc giác Bellman. Ở chế độ chuyên gia, hệ thống cung cấp hướng dẫn kiểm chứng tiêu chuẩn an toàn kỹ thuật IEC 60118 và ISO 8253-1.',
      en: 'Support for users with mild hearing loss using Phonak Lyric hearing aids hidden deep in the ear or Bellman light/tactile alert devices. In expert mode, the system provides guidance on IEC 60118 and ISO 8253-1 technical safety standards verification.'
    },
    expertModeFeatures: [
      'Hướng dẫn kiểm chứng IEC 60118-4 (đo đặc tính kỹ thuật máy trợ thính)',
      'So sánh công nghệ BTE vs CIC vs IIC về gain frequency response',
      'Cài đặt Roger FM system cho môi trường lớp học',
      'Phân tích tiêu chuẩn ISO 8253-1 cho đo thính lực'
    ]
  },

  // ==================== BOT 2: SENSORY - VISION ====================
  {
    id: 'bot-vision',
    name: 'Bot 2: Sensory – Vision',
    nameVi: 'Trợ lý Thị giác',
    avatar: '👁️',
    description: 'Hỗ trợ người khiếm thị với phần mềm đọc màn hình và thiết bị hỗ trợ',
    descriptionVi: 'Hỗ trợ người khiếm thị từ nhẹ đến nặng, cung cấp thông tin về phần mềm đọc màn hình, kính lúp điện tử, thiết bị Braille, và các tiêu chuẩn tiếp cận WCAG 2.1.',
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
      vi: 'Gợi ý phần mềm đọc màn hình mã nguồn mở NVDA miễn phí cho người khiếm thị kết hợp kính lúp điện tử cầm tay Ruby HD. Chuyên gia y tế sẽ được cung cấp chứng nhận khả năng tiếp cận WCAG 2.1 AA và tương thích phần mềm ISO 9241-171.',
      en: 'Recommend free open-source NVDA screen reader for visually impaired users combined with Ruby HD handheld electronic magnifier. Medical professionals will be provided with WCAG 2.1 AA accessibility certification and ISO 9241-171 software compatibility.'
    },
    expertModeFeatures: [
      'So sánh JAWS vs NVDA vs VoiceOver về độ tương thích WCAG 2.1 Level AAA',
      'Hướng dẫn cấu hình OrCam MyEye theo EN 1332-20',
      'Phân tích độ phóng đại tối ưu cho CCTV Magnifier theo WHO guidelines',
      'Tiêu chuẩn ISO 9241-171 cho phần mềm hỗ trợ thị giác'
    ]
  },

  // ==================== BOT 3: VOICE AND SPEECH ====================
  {
    id: 'bot-speech',
    name: 'Bot 3: Voice and Speech',
    nameVi: 'Trợ lý Giọng nói & Lời nói',
    avatar: '💬',
    description: 'Hỗ trợ giao tiếp cho người khó nói với thiết bị AAC và SGD',
    descriptionVi: 'Hỗ trợ trẻ em và người lớn gặp khó khăn trong giao tiếp ngôn ngữ với nhiều nguyên nhân khác nhau. Cung cấp thiết bị giao tiếp tăng cường (AAC) và tích hợp dữ liệu cá nhân qua tiêu chuẩn HL7 FHIR v4.',
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
      vi: 'Hỗ trợ trẻ bị khó khăn về vận động và giao tiếp ở lớp thông qua thiết bị máy tính bảng giao tiếp Tobii Dynavox (điều khiển bằng ánh mắt) hoặc ứng dụng Proloquo2Go. Ở chế độ chuyên gia, hệ thống đề xuất tích hợp dữ liệu cá nhân qua tiêu chuẩn HL7 FHIR v4 và phân loại hỗ trợ theo ISO 9999:2022.',
      en: 'Support for children with physical and communication difficulties in class through Tobii Dynavox tablet communication device (eye-controlled) or Proloquo2Go app. In expert mode, the system proposes personal data integration via HL7 FHIR v4 standard and support classification per ISO 9999:2022.'
    },
    expertModeFeatures: [
      'Tích hợp dữ liệu cá nhân qua tiêu chuẩn HL7 FHIR v4',
      'Phân loại hỗ trợ theo ISO 9999:2022 (codes 05.15, 22.21)',
      'So sánh AAC symbols systems: PCS vs SymbolStix vs Widgit',
      'Phân tích PRD (Pragmatic Rating Dimensions) cho AAC assessment'
    ]
  },

  // ==================== BOT 4: MENTAL - COGNITIVE ====================
  {
    id: 'bot-cognitive',
    name: 'Bot 4: Mental – Cognitive',
    nameVi: 'Trợ lý Nhận thức',
    avatar: '🧠',
    description: 'Hỗ trợ nhận thức cho người cao tuổi và người sa sút trí tuệ',
    descriptionVi: 'Hỗ trợ người cao tuổi, người bị sa sút trí tuệ (dementia), hoặc các rối loạn nhận thức khác. Cung cấp thiết bị nhắc nhở, hỗ trợ trí nhớ, và danh mục công cụ được WHO công nhận.',
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
    ]
  },

  // ==================== BOT 5: NEUROMUSCULOSKELETAL MOVEMENT ====================
  {
    id: 'bot-neuro',
    name: 'Bot 5: Neuromusculoskeletal Movement',
    nameVi: 'Trợ lý Vận động thần kinh – cơ xương',
    avatar: '🦴',
    description: 'Hỗ trợ vận động cho người hạn chế chi trên và phục hồi chức năng',
    descriptionVi: 'Hỗ trợ người bị hạn chế vận động chi trên do chấn thương, bệnh lý thần kinh cơ, hoặc tàn phế. Cung cấp thiết bị điều khiển thay thế và công cụ phục hồi chức năng.',
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
    ]
  },

  // ==================== BOT 6: MOBILITY AND TRANSPORTATION ====================
  {
    id: 'bot-mobility',
    name: 'Bot 6: Mobility & Transportation',
    nameVi: 'Trợ lý Di chuyển & Giao thông',
    avatar: '🦽',
    description: 'Hỗ trợ di chuyển cho người khuyết tật vận động với xe lăn và thiết bị',
    descriptionVi: 'Hỗ trợ người khuyết tật vận động, cung cấp thông tin về xe lăn các loại, thiết bị hỗ trợ di chuyển, và các tiêu chuẩn an toàn châu Âu CE Medical Class II.',
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
    ]
  },

  // ==================== BOT 7: REGULATORY & STANDARDS ====================
  {
    id: 'bot-regulatory',
    name: 'Bot 7: Regulatory & Standards',
    nameVi: 'Trợ lý Quy định & Tiêu chuẩn',
    avatar: '📋',
    description: 'Tra cứu quy định và tiêu chuẩn AT quốc tế cho người dùng và chuyên gia',
    descriptionVi: 'Cổng kết nối thông tin để người dùng tra cứu độ an toàn của thiết bị và chuyên gia CNHT tra cứu nhanh các danh mục quy định tiếp cận của Qatar, phân loại sản phẩm hỗ trợ theo chuẩn quốc tế ISO 9999:2022.',
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
      vi: 'Cổng kết nối thông tin để người dùng tra cứu độ an toàn của thiết bị và chuyên gia tra cứu nhanh các danh mục quy định tiếp cận của Qatar, phân loại danh mục sản phẩm hỗ trợ theo chuẩn quốc tế ISO 9999:2022.',
      en: 'Information portal for users to check device safety and specialists to quickly search Qatar accessibility regulations, classify assistive product categories according to international standard ISO 9999:2022.'
    },
    expertModeFeatures: [
      'Tra cứu nhanh các danh mục quy định tiếp cận của Qatar',
      'Phân loại sản phẩm trợ giúp theo ISO 9999:2022',
      'Kiểm tra độ an toàn thiết bị theo tiêu chuẩn quốc tế',
      'So sánh quy định FDA, CE, và Qatar MADA'
    ]
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
