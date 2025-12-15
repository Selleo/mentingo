/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface RegisterBody {
  /** @format email */
  email: string;
  /**
   * @minLength 1
   * @maxLength 64
   */
  firstName: string;
  /**
   * @minLength 1
   * @maxLength 64
   */
  lastName: string;
  password: string;
  language: "en" | "pl";
}

export interface RegisterResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
  };
}

export interface LoginBody {
  /** @format email */
  email: string;
  /**
   * @minLength 8
   * @maxLength 64
   */
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
    shouldVerifyMFA: boolean;
    onboardingStatus: {
      id: string;
      createdAt: string;
      updatedAt: string;
      userId: string;
      dashboard: boolean;
      courses: boolean;
      announcements: boolean;
      profile: boolean;
      settings: boolean;
      providerInformation: boolean;
    };
  };
}

export type LogoutResponse = null;

export type RefreshTokensResponse = null;

export interface CurrentUserResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
    shouldVerifyMFA: boolean;
    onboardingStatus: {
      id: string;
      createdAt: string;
      updatedAt: string;
      userId: string;
      dashboard: boolean;
      courses: boolean;
      announcements: boolean;
      profile: boolean;
      settings: boolean;
      providerInformation: boolean;
    };
  };
}

export interface ForgotPasswordBody {
  /**
   * @format email
   * @minLength 1
   */
  email: string;
}

export interface CreatePasswordBody {
  password: string;
  /** @minLength 1 */
  createToken: string;
  language: string;
}

export interface ResetPasswordBody {
  newPassword: string;
  /** @minLength 1 */
  resetToken: string;
}

export interface MFASetupResponse {
  data: {
    secret: string;
    otpauth: string;
  };
}

export interface MFAVerifyBody {
  token: string;
}

export interface MFAVerifyResponse {
  data: {
    isValid: boolean;
  };
}

export interface GetPublicGlobalSettingsResponse {
  data: {
    unregisteredUserCoursesAccessibility: boolean;
    enforceSSO: boolean;
    certificateBackgroundImage: string | null;
    companyInformation?: {
      companyName?: string;
      /** @maxLength 10 */
      companyShortName?: string;
      registeredAddress?: string;
      taxNumber?: string;
      emailAddress?: string;
      courtRegisterNumber?: string;
    };
    platformLogoS3Key: string | null;
    loginBackgroundImageS3Key: string | null;
    platformSimpleLogoS3Key: string | null;
    MFAEnforcedRoles: ("admin" | "student" | "content_creator")[];
    defaultCourseCurrency: "pln" | "eur" | "gbp" | "usd";
    inviteOnlyRegistration: boolean;
    userEmailTriggers: {
      userFirstLogin: boolean;
      userCourseAssignment: boolean;
      userShortInactivity: boolean;
      userLongInactivity: boolean;
      userChapterFinished: boolean;
      userCourseFinished: boolean;
    };
    primaryColor: string | null;
    contrastColor: string | null;
    unregisteredUserQAAccessibility: boolean;
    QAEnabled: boolean;
  };
}

export interface GetUserSettingsResponse {
  data:
    | {
        language: string;
        /** @default false */
        isMFAEnabled: boolean;
        MFASecret: string | null;
      }
    | {
        language: string;
        /** @default false */
        isMFAEnabled: boolean;
        MFASecret: string | null;
        adminNewUserNotification: boolean;
        adminFinishedCourseNotification: boolean;
        configWarningDismissed: boolean;
      };
}

export type UpdateUserSettingsBody =
  | {
      language?: string;
      /** @default false */
      isMFAEnabled?: boolean;
      MFASecret?: string | null;
    }
  | {
      language?: string;
      /** @default false */
      isMFAEnabled?: boolean;
      MFASecret?: string | null;
      adminNewUserNotification?: boolean;
      adminFinishedCourseNotification?: boolean;
      configWarningDismissed?: boolean;
    };

export interface UpdateUserSettingsResponse {
  data:
    | {
        language: string;
        /** @default false */
        isMFAEnabled: boolean;
        MFASecret: string | null;
      }
    | {
        language: string;
        /** @default false */
        isMFAEnabled: boolean;
        MFASecret: string | null;
        adminNewUserNotification: boolean;
        adminFinishedCourseNotification: boolean;
        configWarningDismissed: boolean;
      };
}

export interface UpdateAdminNewUserNotificationResponse {
  data: {
    language: string;
    /** @default false */
    isMFAEnabled: boolean;
    MFASecret: string | null;
    adminNewUserNotification: boolean;
    adminFinishedCourseNotification: boolean;
    configWarningDismissed: boolean;
  };
}

export interface UpdateUnregisteredUserCoursesAccessibilityResponse {
  data: {
    unregisteredUserCoursesAccessibility: boolean;
    enforceSSO: boolean;
    certificateBackgroundImage: string | null;
    companyInformation?: {
      companyName?: string;
      /** @maxLength 10 */
      companyShortName?: string;
      registeredAddress?: string;
      taxNumber?: string;
      emailAddress?: string;
      courtRegisterNumber?: string;
    };
    platformLogoS3Key: string | null;
    loginBackgroundImageS3Key: string | null;
    platformSimpleLogoS3Key: string | null;
    MFAEnforcedRoles: ("admin" | "student" | "content_creator")[];
    defaultCourseCurrency: "pln" | "eur" | "gbp" | "usd";
    inviteOnlyRegistration: boolean;
    userEmailTriggers: {
      userFirstLogin: boolean;
      userCourseAssignment: boolean;
      userShortInactivity: boolean;
      userLongInactivity: boolean;
      userChapterFinished: boolean;
      userCourseFinished: boolean;
    };
    primaryColor: string | null;
    contrastColor: string | null;
    unregisteredUserQAAccessibility: boolean;
    QAEnabled: boolean;
  };
}

export interface UpdateEnforceSSOResponse {
  data: {
    unregisteredUserCoursesAccessibility: boolean;
    enforceSSO: boolean;
    certificateBackgroundImage: string | null;
    companyInformation?: {
      companyName?: string;
      /** @maxLength 10 */
      companyShortName?: string;
      registeredAddress?: string;
      taxNumber?: string;
      emailAddress?: string;
      courtRegisterNumber?: string;
    };
    platformLogoS3Key: string | null;
    loginBackgroundImageS3Key: string | null;
    platformSimpleLogoS3Key: string | null;
    MFAEnforcedRoles: ("admin" | "student" | "content_creator")[];
    defaultCourseCurrency: "pln" | "eur" | "gbp" | "usd";
    inviteOnlyRegistration: boolean;
    userEmailTriggers: {
      userFirstLogin: boolean;
      userCourseAssignment: boolean;
      userShortInactivity: boolean;
      userLongInactivity: boolean;
      userChapterFinished: boolean;
      userCourseFinished: boolean;
    };
    primaryColor: string | null;
    contrastColor: string | null;
    unregisteredUserQAAccessibility: boolean;
    QAEnabled: boolean;
  };
}

export interface UpdateAdminFinishedCourseNotificationResponse {
  data: {
    language: string;
    /** @default false */
    isMFAEnabled: boolean;
    MFASecret: string | null;
    adminNewUserNotification: boolean;
    adminFinishedCourseNotification: boolean;
    configWarningDismissed: boolean;
  };
}

export interface UpdateColorSchemaBody {
  /** @pattern ^#(?:[0-9a-fA-F]{3}){1,2}$ */
  primaryColor: string;
  /** @pattern ^#(?:[0-9a-fA-F]{3}){1,2}$ */
  contrastColor: string;
}

export interface UpdateColorSchemaResponse {
  data: {
    unregisteredUserCoursesAccessibility: boolean;
    enforceSSO: boolean;
    certificateBackgroundImage: string | null;
    companyInformation?: {
      companyName?: string;
      /** @maxLength 10 */
      companyShortName?: string;
      registeredAddress?: string;
      taxNumber?: string;
      emailAddress?: string;
      courtRegisterNumber?: string;
    };
    platformLogoS3Key: string | null;
    loginBackgroundImageS3Key: string | null;
    platformSimpleLogoS3Key: string | null;
    MFAEnforcedRoles: ("admin" | "student" | "content_creator")[];
    defaultCourseCurrency: "pln" | "eur" | "gbp" | "usd";
    inviteOnlyRegistration: boolean;
    userEmailTriggers: {
      userFirstLogin: boolean;
      userCourseAssignment: boolean;
      userShortInactivity: boolean;
      userLongInactivity: boolean;
      userChapterFinished: boolean;
      userCourseFinished: boolean;
    };
    primaryColor: string | null;
    contrastColor: string | null;
    unregisteredUserQAAccessibility: boolean;
    QAEnabled: boolean;
  };
}

export interface GetPlatformLogoResponse {
  data: {
    url: string | null;
  };
}

export interface GetPlatformSimpleLogoResponse {
  data: {
    url: string | null;
  };
}

export interface GetLoginBackgroundResponse {
  data: {
    url: string | null;
  };
}

export interface GetCompanyInformationResponse {
  data: {
    companyName?: string;
    /** @maxLength 10 */
    companyShortName?: string;
    registeredAddress?: string;
    taxNumber?: string;
    emailAddress?: string;
    courtRegisterNumber?: string;
  };
}

export interface UpdateCompanyInformationBody {
  companyName?: string;
  /** @maxLength 10 */
  companyShortName?: string;
  registeredAddress?: string;
  taxNumber?: string;
  emailAddress?: string;
  courtRegisterNumber?: string;
}

export interface UpdateCompanyInformationResponse {
  data: {
    companyName?: string;
    /** @maxLength 10 */
    companyShortName?: string;
    registeredAddress?: string;
    taxNumber?: string;
    emailAddress?: string;
    courtRegisterNumber?: string;
  };
}

export interface UpdateMFAEnforcedRolesBody {
  admin?: boolean;
  student?: boolean;
  content_creator?: boolean;
}

export interface UpdateDefaultCourseCurrencyBody {
  defaultCourseCurrency: "pln" | "eur" | "gbp" | "usd";
}

export interface UpdateConfigWarningDismissedBody {
  dismissed: boolean;
}

export interface UpdateConfigWarningDismissedResponse {
  data: {
    language: string;
    /** @default false */
    isMFAEnabled: boolean;
    MFASecret: string | null;
    adminNewUserNotification: boolean;
    adminFinishedCourseNotification: boolean;
    configWarningDismissed: boolean;
  };
}

export interface FileUploadResponse {
  fileKey: string;
  fileUrl: string;
}

export interface GetUserStatisticsResponse {
  data: {
    averageStats: {
      lessonStats: {
        started: number;
        completed: number;
        completionRate: number;
      };
      courseStats: {
        started: number;
        completed: number;
        completionRate: number;
      };
    };
    quizzes: {
      totalAttempts: number;
      totalCorrectAnswers: number;
      totalWrongAnswers: number;
      totalQuestions: number;
      averageScore: number;
      uniqueQuizzesTaken: number;
    };
    courses: object;
    lessons: object;
    streak: {
      current: number;
      longest: number;
      activityHistory: object;
    };
    nextLesson: {
      /** @format uuid */
      courseId: string;
      courseTitle: string;
      courseDescription: string;
      courseThumbnail: string;
      /** @format uuid */
      lessonId: string;
      chapterTitle: string;
      chapterProgress: "not_started" | "in_progress" | "completed" | "blocked";
      completedLessonCount: number;
      lessonCount: number;
      chapterDisplayOrder: number;
    } | null;
  };
}

export interface GetStatsResponse {
  data: {
    fiveMostPopularCourses: {
      courseName: string;
      studentCount: number;
    }[];
    totalCoursesCompletionStats: {
      completionPercentage: number;
      totalCoursesCompletion: number;
      totalCourses: number;
    };
    conversionAfterFreemiumLesson: {
      conversionPercentage: number;
      purchasedCourses: number;
      remainedOnFreemium: number;
    };
    courseStudentsStats: object;
    avgQuizScore: {
      correctAnswerCount: number;
      wrongAnswerCount: number;
      answerCount: number;
    };
  };
}

export interface GetUsersResponse {
  data: ({
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
  } & {
    groups: {
      /** @format uuid */
      id: string;
      name: string;
    }[];
  })[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetUserByIdResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
    groups: {
      /** @format uuid */
      id: string;
      name: string;
    }[];
  };
}

export interface GetUserDetailsResponse {
  data: {
    firstName: string | null;
    lastName: string | null;
    /** @format uuid */
    id: string;
    description: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    jobTitle: string | null;
    role: "admin" | "student" | "content_creator";
    profilePictureUrl: string | null;
  };
}

export interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  groups?: string[] | null;
  /** @format email */
  email?: string;
  role?: "admin" | "student" | "content_creator";
  archived?: boolean;
}

export interface UpdateUserResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
  };
}

export interface UpsertUserDetailsBody {
  description?: string;
  /** @format email */
  contactEmail?: string;
  contactPhoneNumber?: string;
  jobTitle?: string;
}

export interface UpsertUserDetailsResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export interface AdminUpdateUserBody {
  firstName?: string;
  lastName?: string;
  groups?: string[] | null;
  /** @format email */
  email?: string;
  role?: "admin" | "student" | "content_creator";
  archived?: boolean;
}

export interface AdminUpdateUserResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    archived: boolean;
    deletedAt: string | null;
    profilePictureUrl: string | null;
  };
}

export interface ChangePasswordBody {
  newPassword: string;
  /**
   * @minLength 8
   * @maxLength 64
   */
  oldPassword: string;
}

export type ChangePasswordResponse = null;

export interface DeleteBulkUsersBody {
  userIds: string[];
}

export type DeleteBulkUsersResponse = null;

export type BulkAssignUsersToGroupBody = {
  /** @format uuid */
  userId: string;
  groups: string[];
}[];

export interface ArchiveBulkUsersBody {
  userIds: string[];
}

export interface ArchiveBulkUsersResponse {
  data: {
    archivedUsersCount: number;
    usersAlreadyArchivedCount: number;
  };
}

export interface CreateUserBody {
  /** @format email */
  email: string;
  /**
   * @minLength 1
   * @maxLength 64
   */
  firstName: string;
  /**
   * @minLength 1
   * @maxLength 64
   */
  lastName: string;
  role: "admin" | "student" | "content_creator";
  language?: string;
}

export interface CreateUserResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export interface ImportUsersResponse {
  data: {
    importedUsersAmount: number;
    skippedUsersAmount: number;
    importedUsersList: string[];
    skippedUsersList: {
      /** @format email */
      email: string;
      reason: string;
    }[];
  };
}

export interface ResetOnboardingStatusResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    dashboard: boolean;
    courses: boolean;
    announcements: boolean;
    profile: boolean;
    settings: boolean;
    providerInformation: boolean;
  };
}

export interface MarkOnboardingCompleteResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    dashboard: boolean;
    courses: boolean;
    announcements: boolean;
    profile: boolean;
    settings: boolean;
    providerInformation: boolean;
  };
}

export interface GetAllGroupsResponse {
  data: {
    /** @format uuid */
    id: string;
    name: string;
    characteristic: string | null;
    users?: {
      id: string;
      createdAt: string;
      updatedAt: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      archived: boolean;
      deletedAt: string | null;
      profilePictureUrl: string | null;
    }[];
    createdAt?: string;
    updatedAt?: string;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetGroupByIdResponse {
  data: {
    /** @format uuid */
    id: string;
    name: string;
    characteristic: string | null;
    users?: {
      id: string;
      createdAt: string;
      updatedAt: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      archived: boolean;
      deletedAt: string | null;
      profilePictureUrl: string | null;
    }[];
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface GetUserGroupsResponse {
  data: {
    /** @format uuid */
    id: string;
    name: string;
    characteristic: string | null;
    users?: {
      id: string;
      createdAt: string;
      updatedAt: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      archived: boolean;
      deletedAt: string | null;
      profilePictureUrl: string | null;
    }[];
    createdAt?: string;
    updatedAt?: string;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface CreateGroupBody {
  name: string;
  characteristic?: string;
}

export interface CreateGroupResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export interface UpdateGroupBody {
  name: string;
  characteristic?: string;
}

export interface UpdateGroupResponse {
  data: {
    /** @format uuid */
    id: string;
    name: string;
    characteristic?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DeleteGroupResponse {
  data: {
    message: string;
  };
}

export type BulkDeleteGroupsBody = string[];

export interface BulkDeleteGroupsResponse {
  data: {
    message: string;
  };
}

export type GroupIds = string[];

export interface SetUserGroupsResponse {
  data: {
    message: string;
  };
}

export interface GetGroupsByCourseResponse {
  data: {
    /** @format uuid */
    id: string;
    name: string;
    characteristic?: string;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface GetAllCoursesResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    thumbnailUrl: string | null;
    description: string;
    /** @format uuid */
    authorId?: string;
    author: string;
    authorEmail?: string;
    authorAvatarUrl: string | null;
    category: string;
    courseChapterCount: number;
    enrolledParticipantCount: number;
    priceInCents: number;
    currency: string;
    status?: "draft" | "published" | "private";
    createdAt?: string;
    hasFreeChapters?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetStudentCoursesResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    thumbnailUrl: string | null;
    description: string;
    /** @format uuid */
    authorId?: string;
    author: string;
    authorEmail?: string;
    authorAvatarUrl: string | null;
    category: string;
    courseChapterCount: number;
    enrolledParticipantCount: number;
    priceInCents: number;
    currency: string;
    status?: "draft" | "published" | "private";
    createdAt?: string;
    hasFreeChapters?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    completedChapterCount: number;
    enrolled?: boolean;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetStudentsWithEnrollmentDateResponse {
  data: {
    firstName: string;
    lastName: string;
    email: string;
    enrolledAt: string | null;
    groups: {
      /** @format uuid */
      id: string;
      name: string;
    }[];
    /** @format uuid */
    id: string;
    isEnrolledByGroup: boolean;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetAvailableCoursesResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    thumbnailUrl: string | null;
    description: string;
    /** @format uuid */
    authorId?: string;
    author: string;
    authorEmail?: string;
    authorAvatarUrl: string | null;
    category: string;
    courseChapterCount: number;
    enrolledParticipantCount: number;
    priceInCents: number;
    currency: string;
    status?: "draft" | "published" | "private";
    createdAt?: string;
    hasFreeChapters?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    completedChapterCount: number;
    enrolled?: boolean;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetContentCreatorCoursesResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    thumbnailUrl: string | null;
    description: string;
    /** @format uuid */
    authorId: string;
    author: string;
    authorEmail: string;
    authorAvatarUrl: string | null;
    category: string;
    courseChapterCount: number;
    enrolledParticipantCount: number;
    priceInCents: number;
    currency: string;
    status?: "draft" | "published" | "private";
    createdAt?: string;
    hasFreeChapters?: boolean;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    completedChapterCount: number;
    enrolled?: boolean;
  }[];
}

export interface GetCourseResponse {
  data: {
    archived?: boolean;
    /** @format uuid */
    authorId?: string;
    category: string;
    /** @format uuid */
    categoryId?: string;
    chapters: {
      /** @format uuid */
      id: string;
      title: string;
      lessonCount: number;
      lessons: {
        /** @format uuid */
        id: string;
        title: string;
        type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
        displayOrder: number;
        status: "not_started" | "in_progress" | "completed" | "blocked";
        quizQuestionCount: number | null;
        isExternal?: boolean;
        lessonResources?: {
          /** @format uuid */
          id: string;
          source: string;
          isExternal: boolean;
          allowFullscreen: boolean;
          type: "embed";
          /** @format uuid */
          lessonId: string;
          displayOrder: number;
          createdAt: string;
          updatedAt: string;
        }[];
      }[];
      completedLessonCount?: number;
      chapterProgress?: "not_started" | "in_progress" | "completed" | "blocked";
      isFreemium?: boolean;
      enrolled?: boolean;
      isSubmitted?: boolean;
      createdAt?: string;
      updatedAt?: string;
      quizCount?: number;
      displayOrder: number;
    }[];
    completedChapterCount?: number;
    courseChapterCount: number;
    currency: string;
    description: string;
    enrolled?: boolean;
    hasFreeChapter?: boolean;
    hasCertificate?: boolean;
    /** @format uuid */
    id: string;
    status: "draft" | "published" | "private";
    isScorm?: boolean;
    priceInCents: number;
    thumbnailUrl?: string;
    title: string;
    stripeProductId: string | null;
    stripePriceId: string | null;
    availableLocales: ("en" | "pl")[];
    baseLanguage: "en" | "pl";
  };
}

export interface GetBetaCourseByIdResponse {
  data: {
    archived?: boolean;
    /** @format uuid */
    authorId?: string;
    category: string;
    /** @format uuid */
    categoryId?: string;
    chapters: {
      /** @format uuid */
      id: string;
      title: string;
      lessonCount: number;
      lessons?: {
        /** @format uuid */
        id: string;
        title: string;
        type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
        description?: string | null;
        displayOrder: number;
        fileS3Key?: string | null;
        avatarReferenceUrl?: string;
        fileType?: string | null;
        questions?: {
          /** @format uuid */
          id?: string;
          type:
            | "brief_response"
            | "detailed_response"
            | "match_words"
            | "scale_1_5"
            | "single_choice"
            | "multiple_choice"
            | "true_or_false"
            | "photo_question_single_choice"
            | "photo_question_multiple_choice"
            | "fill_in_the_blanks_text"
            | "fill_in_the_blanks_dnd";
          description?: string | null;
          title: string;
          displayOrder?: number;
          solutionExplanation?: string;
          photoS3Key?: string | null;
          options?: {
            /** @format uuid */
            id?: string;
            /** @maxLength 250 */
            optionText: string;
            displayOrder: number | null;
            isStudentAnswer?: boolean | null;
            isCorrect: boolean;
            /** @format uuid */
            questionId?: string;
            matchedWord?: string | null;
            scaleAnswer?: number | null;
            /** @default "en" */
            language?: "en" | "pl";
          }[];
          /** @default "en" */
          language?: "en" | "pl";
        }[];
        aiMentor?: {
          /** @format uuid */
          id: string;
          /** @format uuid */
          lessonId: string;
          aiMentorInstructions: string;
          completionConditions: string;
          type: "mentor" | "teacher" | "roleplay";
          avatarReference: string | null;
        } | null;
        updatedAt?: string;
      }[];
      completedLessonCount?: number;
      chapterProgress?: "not_started" | "in_progress" | "completed" | "blocked";
      isFreemium?: boolean;
      enrolled?: boolean;
      isSubmitted?: boolean;
      createdAt?: string;
      updatedAt?: string;
      quizCount?: number;
      displayOrder: number;
    }[];
    completedChapterCount?: number;
    courseChapterCount: number;
    currency: string;
    description: string;
    enrolled?: boolean;
    hasFreeChapter?: boolean;
    hasCertificate?: boolean;
    /** @format uuid */
    id: string;
    status: "draft" | "published" | "private";
    isScorm?: boolean;
    priceInCents: number;
    thumbnailUrl?: string;
    thumbnailS3Key?: string;
    thumbnailS3SingedUrl?: string | null;
    title: string;
    availableLocales: ("en" | "pl")[];
    baseLanguage: "en" | "pl";
  };
}

export type CreateCourseBody = {
  title: string;
  description: string;
  status?: "draft" | "published" | "private";
  thumbnailS3Key?: string;
  priceInCents?: number;
  currency?: string;
  /** @format uuid */
  categoryId: string;
  isScorm?: boolean;
  hasCertificate?: boolean;
  /** @default "en" */
  language: "en" | "pl";
} & {
  chapters?: string[];
};

export interface CreateCourseResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export interface UpdateCourseBody {
  title?: string;
  description?: string;
  thumbnailS3Key?: string;
  status?: "draft" | "published" | "private";
  priceInCents?: number;
  currency?: string;
  /** @format uuid */
  categoryId?: string;
  chapters?: string[];
  archived?: boolean;
  /** @default "en" */
  language?: "en" | "pl";
}

export interface UpdateCourseResponse {
  data: {
    message: string;
  };
}

export interface UpdateHasCertificateBody {
  hasCertificate: boolean;
}

export interface UpdateHasCertificateResponse {
  data: {
    message: string;
  };
}

export interface UpdateLessonSequenceEnabledBody {
  lessonSequenceEnabled: boolean;
}

export interface UpdateLessonSequenceEnabledResponse {
  data: {
    message: string;
  };
}

export interface GetLessonSequenceEnabledResponse {
  data: {
    lessonSequenceEnabled: boolean;
  };
}

export interface EnrollCourseResponse {
  data: {
    message: string;
  };
}

export interface EnrollCoursesBody {
  studentIds: string[];
}

export interface EnrollCoursesResponse {
  data: {
    message: string;
  };
}

export interface EnrollGroupsToCourseBody {
  groupIds: string[];
}

export interface EnrollGroupsToCourseResponse {
  data: {
    message: string;
  };
}

export interface UnenrollGroupsFromCourseBody {
  groupIds: string[];
}

export interface UnenrollGroupsFromCourseResponse {
  data: {
    message: string;
  };
}

export type DeleteCourseResponse = null;

export interface DeleteManyCoursesBody {
  ids: string[];
}

export type DeleteManyCoursesResponse = null;

export type UnenrollCoursesResponse = null;

export interface GetCourseStatisticsResponse {
  data: {
    enrolledCount: number;
    completionPercentage: number;
    averageCompletionPercentage: number;
    courseStatusDistribution: {
      status: "not_started" | "in_progress" | "completed" | "blocked";
      count: number;
    }[];
  };
}

export interface GetAverageQuizScoresResponse {
  data: {
    averageScoresPerQuiz: {
      /** @format uuid */
      quizId: string;
      name: string;
      averageScore: number;
      finishedCount: number;
      lessonOrder: number;
    }[];
  };
}

export interface GetCourseStudentsProgressResponse {
  data: {
    /** @format uuid */
    studentId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    groups:
      | {
          id: string;
          name: string;
        }[]
      | null;
    completedLessonsCount: number;
    lastActivity: string | null;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetCourseStudentsQuizResultsResponse {
  data: {
    /** @format uuid */
    studentId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    /** @format uuid */
    lessonId: string;
    quizName: string;
    quizScore: number;
    attempts: number;
    lastAttempt: string;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetCourseStudentsAiMentorResultsResponse {
  data: {
    /** @format uuid */
    studentId: string;
    studentName: string;
    studentAvatarUrl: string | null;
    /** @format uuid */
    lessonId: string;
    lessonName: string;
    score: number;
    lastSession: string;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetChapterWithLessonResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    lessonCount: number;
    lessons: {
      /** @format uuid */
      id: string;
      title: string;
      type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
      displayOrder: number;
      status: "not_started" | "in_progress" | "completed" | "blocked";
      quizQuestionCount: number | null;
      isExternal?: boolean;
      lessonResources?: {
        /** @format uuid */
        id: string;
        source: string;
        isExternal: boolean;
        allowFullscreen: boolean;
        type: "embed";
        /** @format uuid */
        lessonId: string;
        displayOrder: number;
        createdAt: string;
        updatedAt: string;
      }[];
    }[];
    completedLessonCount?: number;
    chapterProgress?: "not_started" | "in_progress" | "completed" | "blocked";
    isFreemium?: boolean;
    enrolled?: boolean;
    isSubmitted?: boolean;
    createdAt?: string;
    updatedAt?: string;
    quizCount?: number;
    displayOrder: number;
  };
}

export type BetaCreateChapterBody = {
  title: string;
  lessons?: {
    /** @format uuid */
    id: string;
    title: string;
    type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
    description?: string | null;
    displayOrder: number;
    fileS3Key?: string | null;
    avatarReferenceUrl?: string;
    fileType?: string | null;
    questions?: {
      /** @format uuid */
      id?: string;
      type:
        | "brief_response"
        | "detailed_response"
        | "match_words"
        | "scale_1_5"
        | "single_choice"
        | "multiple_choice"
        | "true_or_false"
        | "photo_question_single_choice"
        | "photo_question_multiple_choice"
        | "fill_in_the_blanks_text"
        | "fill_in_the_blanks_dnd";
      description?: string | null;
      title: string;
      displayOrder?: number;
      solutionExplanation?: string;
      photoS3Key?: string | null;
      options?: {
        /** @format uuid */
        id?: string;
        /** @maxLength 250 */
        optionText: string;
        displayOrder: number | null;
        isStudentAnswer?: boolean | null;
        isCorrect: boolean;
        /** @format uuid */
        questionId?: string;
        matchedWord?: string | null;
        scaleAnswer?: number | null;
        /** @default "en" */
        language?: "en" | "pl";
      }[];
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    aiMentor?: {
      /** @format uuid */
      id: string;
      /** @format uuid */
      lessonId: string;
      aiMentorInstructions: string;
      completionConditions: string;
      type: "mentor" | "teacher" | "roleplay";
      avatarReference: string | null;
    } | null;
    updatedAt?: string;
  }[];
  chapterProgress?: "not_started" | "in_progress" | "completed" | "blocked";
  isFreemium?: boolean;
  enrolled?: boolean;
  isSubmitted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  quizCount?: number;
} & {
  /** @format uuid */
  courseId: string;
};

export interface BetaCreateChapterResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export type UpdateChapterBody = ({
  title?: string;
  lessons?: {
    /** @format uuid */
    id: string;
    title: string;
    type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
    description?: string | null;
    displayOrder: number;
    fileS3Key?: string | null;
    avatarReferenceUrl?: string;
    fileType?: string | null;
    questions?: {
      /** @format uuid */
      id?: string;
      type:
        | "brief_response"
        | "detailed_response"
        | "match_words"
        | "scale_1_5"
        | "single_choice"
        | "multiple_choice"
        | "true_or_false"
        | "photo_question_single_choice"
        | "photo_question_multiple_choice"
        | "fill_in_the_blanks_text"
        | "fill_in_the_blanks_dnd";
      description?: string | null;
      title: string;
      displayOrder?: number;
      solutionExplanation?: string;
      photoS3Key?: string | null;
      options?: {
        /** @format uuid */
        id?: string;
        /** @maxLength 250 */
        optionText: string;
        displayOrder: number | null;
        isStudentAnswer?: boolean | null;
        isCorrect: boolean;
        /** @format uuid */
        questionId?: string;
        matchedWord?: string | null;
        scaleAnswer?: number | null;
        /** @default "en" */
        language?: "en" | "pl";
      }[];
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    aiMentor?: {
      /** @format uuid */
      id: string;
      /** @format uuid */
      lessonId: string;
      aiMentorInstructions: string;
      completionConditions: string;
      type: "mentor" | "teacher" | "roleplay";
      avatarReference: string | null;
    } | null;
    updatedAt?: string;
  }[];
  chapterProgress?: "not_started" | "in_progress" | "completed" | "blocked";
  isFreemium?: boolean;
  enrolled?: boolean;
  isSubmitted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  quizCount?: number;
} & {
  /** @format uuid */
  courseId?: string;
}) & {
  /** @default "en" */
  language: "en" | "pl";
};

export interface UpdateChapterResponse {
  data: {
    message: string;
  };
}

export interface UpdateChapterDisplayOrderBody {
  /** @format uuid */
  chapterId: string;
  displayOrder: number;
}

export interface UpdateChapterDisplayOrderResponse {
  data: {
    message: string;
  };
}

export interface RemoveChapterResponse {
  data: {
    message: string;
  };
}

export interface UpdateFreemiumStatusBody {
  isFreemium: boolean;
}

export interface UpdateFreemiumStatusResponse {
  data: {
    message: string;
  };
}

export interface GetEnrolledLessonsResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
    description: string | null;
    displayOrder: number;
    lessonCompleted: boolean;
    /** @format uuid */
    courseId: string;
    courseTitle: string;
    /** @format uuid */
    chapterId: string;
    chapterTitle: string;
    chapterDisplayOrder: number;
  }[];
}

export interface GetLessonByIdResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
    description: string | null;
    fileType: string | null;
    fileUrl: string | null;
    quizDetails?: {
      questions: {
        /** @format uuid */
        id: string;
        type:
          | "brief_response"
          | "detailed_response"
          | "match_words"
          | "scale_1_5"
          | "single_choice"
          | "multiple_choice"
          | "true_or_false"
          | "photo_question_single_choice"
          | "photo_question_multiple_choice"
          | "fill_in_the_blanks_text"
          | "fill_in_the_blanks_dnd";
        description?: string | null;
        title: string;
        displayOrder?: number;
        solutionExplanation: string | null;
        photoS3Key?: string | null;
        options?: {
          /** @format uuid */
          id: string;
          optionText: string | null;
          displayOrder: number | null;
          isStudentAnswer: boolean | null;
          studentAnswer: string | null;
          isCorrect: boolean | null;
          /** @format uuid */
          questionId?: string;
        }[];
        /** @default "en" */
        language?: "en" | "pl";
        passQuestion: boolean | null;
      }[];
      questionCount: number;
      correctAnswerCount: number | null;
      wrongAnswerCount: number | null;
      score: number | null;
    };
    lessonCompleted?: boolean;
    thresholdScore: number | null;
    attemptsLimit: number | null;
    quizCooldownInHours: number | null;
    isQuizPassed: boolean | null;
    attempts: number | null;
    updatedAt: string | null;
    displayOrder: number;
    isExternal?: boolean;
    nextLessonId: string | null;
    userLanguage?: "en" | "pl";
    status?: "active" | "completed" | "archived";
    /** @format uuid */
    threadId?: string;
    lessonResources?: {
      /** @format uuid */
      id: string;
      source: string;
      isExternal: boolean;
      allowFullscreen: boolean;
      type: "embed";
      /** @format uuid */
      lessonId: string;
      displayOrder: number;
      createdAt: string;
      updatedAt: string;
    }[];
    aiMentorDetails?: {
      minScore: number | null;
      maxScore: number | null;
      score: number | null;
      percentage: number | null;
      requiredScore: number | null;
    } | null;
    aiMentor?: {
      name: string | null;
      avatarReferenceUrl?: string;
    } | null;
  };
}

export type BetaCreateLessonBody = {
  title: string;
  type: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
  description?: string | null;
  fileS3Key?: string | null;
  avatarReferenceUrl?: string;
  fileType?: string | null;
  questions?: {
    /** @format uuid */
    id?: string;
    type:
      | "brief_response"
      | "detailed_response"
      | "match_words"
      | "scale_1_5"
      | "single_choice"
      | "multiple_choice"
      | "true_or_false"
      | "photo_question_single_choice"
      | "photo_question_multiple_choice"
      | "fill_in_the_blanks_text"
      | "fill_in_the_blanks_dnd";
    description?: string | null;
    title: string;
    displayOrder?: number;
    solutionExplanation?: string;
    photoS3Key?: string | null;
    options?: {
      /** @format uuid */
      id?: string;
      /** @maxLength 250 */
      optionText: string;
      displayOrder: number | null;
      isStudentAnswer?: boolean | null;
      isCorrect: boolean;
      /** @format uuid */
      questionId?: string;
      matchedWord?: string | null;
      scaleAnswer?: number | null;
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    /** @default "en" */
    language?: "en" | "pl";
  }[];
  aiMentor?: {
    /** @format uuid */
    id: string;
    /** @format uuid */
    lessonId: string;
    aiMentorInstructions: string;
    completionConditions: string;
    type: "mentor" | "teacher" | "roleplay";
    avatarReference: string | null;
  } | null;
  updatedAt?: string;
} & {
  /** @format uuid */
  chapterId: string;
  displayOrder?: number;
};

export interface BetaCreateLessonResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export type BetaCreateAiMentorLessonBody = {
  title: string;
  description?: string | null;
  fileS3Key?: string | null;
  avatarReferenceUrl?: string;
  fileType?: string | null;
  questions?: {
    /** @format uuid */
    id?: string;
    type:
      | "brief_response"
      | "detailed_response"
      | "match_words"
      | "scale_1_5"
      | "single_choice"
      | "multiple_choice"
      | "true_or_false"
      | "photo_question_single_choice"
      | "photo_question_multiple_choice"
      | "fill_in_the_blanks_text"
      | "fill_in_the_blanks_dnd";
    description?: string | null;
    title: string;
    displayOrder?: number;
    solutionExplanation?: string;
    photoS3Key?: string | null;
    options?: {
      /** @format uuid */
      id?: string;
      /** @maxLength 250 */
      optionText: string;
      displayOrder: number | null;
      isStudentAnswer?: boolean | null;
      isCorrect: boolean;
      /** @format uuid */
      questionId?: string;
      matchedWord?: string | null;
      scaleAnswer?: number | null;
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    /** @default "en" */
    language?: "en" | "pl";
  }[];
  aiMentor?: {
    /** @format uuid */
    id: string;
    /** @format uuid */
    lessonId: string;
    aiMentorInstructions: string;
    completionConditions: string;
    type: "mentor" | "teacher" | "roleplay";
    avatarReference: string | null;
  } | null;
  updatedAt?: string;
} & {
  /** @format uuid */
  chapterId: string;
  displayOrder?: number;
  aiMentorInstructions: string;
  completionConditions: string;
  type: "mentor" | "teacher" | "roleplay";
  name?: string;
};

export interface BetaCreateAiMentorLessonResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export type BetaUpdateAiMentorLessonBody = ({
  title: string;
  description?: string | null;
  fileS3Key?: string | null;
  avatarReferenceUrl?: string;
  fileType?: string | null;
  questions?: {
    /** @format uuid */
    id?: string;
    type:
      | "brief_response"
      | "detailed_response"
      | "match_words"
      | "scale_1_5"
      | "single_choice"
      | "multiple_choice"
      | "true_or_false"
      | "photo_question_single_choice"
      | "photo_question_multiple_choice"
      | "fill_in_the_blanks_text"
      | "fill_in_the_blanks_dnd";
    description?: string | null;
    title: string;
    displayOrder?: number;
    solutionExplanation?: string;
    photoS3Key?: string | null;
    options?: {
      /** @format uuid */
      id?: string;
      /** @maxLength 250 */
      optionText: string;
      displayOrder: number | null;
      isStudentAnswer?: boolean | null;
      isCorrect: boolean;
      /** @format uuid */
      questionId?: string;
      matchedWord?: string | null;
      scaleAnswer?: number | null;
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    /** @default "en" */
    language?: "en" | "pl";
  }[];
  aiMentor?: {
    /** @format uuid */
    id: string;
    /** @format uuid */
    lessonId: string;
    aiMentorInstructions: string;
    completionConditions: string;
    type: "mentor" | "teacher" | "roleplay";
    avatarReference: string | null;
  } | null;
  updatedAt?: string;
} & {
  aiMentorInstructions: string;
  completionConditions: string;
  type: "mentor" | "teacher" | "roleplay";
  name?: string;
}) & {
  /** @default "en" */
  language: "en" | "pl";
};

export interface BetaUpdateAiMentorLessonResponse {
  data: {
    message: string;
  };
}

export type BetaCreateQuizLessonBody = {
  title: string;
  type: string;
  description?: string;
  solutionExplanation?: string;
  fileS3Key?: string;
  fileType?: string;
  thresholdScore: number;
  attemptsLimit: number | null;
  quizCooldownInHours: number | null;
  questions?: {
    /** @format uuid */
    id?: string;
    type:
      | "brief_response"
      | "detailed_response"
      | "match_words"
      | "scale_1_5"
      | "single_choice"
      | "multiple_choice"
      | "true_or_false"
      | "photo_question_single_choice"
      | "photo_question_multiple_choice"
      | "fill_in_the_blanks_text"
      | "fill_in_the_blanks_dnd";
    description?: string | null;
    title: string;
    displayOrder?: number;
    solutionExplanation?: string;
    photoS3Key?: string | null;
    options?: {
      /** @format uuid */
      id?: string;
      /** @maxLength 250 */
      optionText: string;
      displayOrder: number | null;
      isStudentAnswer?: boolean | null;
      isCorrect: boolean;
      /** @format uuid */
      questionId?: string;
      matchedWord?: string | null;
      scaleAnswer?: number | null;
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    /** @default "en" */
    language?: "en" | "pl";
  }[];
} & {
  /** @format uuid */
  chapterId: string;
  displayOrder?: number;
};

export interface BetaCreateQuizLessonResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export type BetaUpdateQuizLessonBody = ({
  title?: string;
  type?: string;
  description?: string;
  solutionExplanation?: string;
  fileS3Key?: string;
  fileType?: string;
  thresholdScore?: number;
  attemptsLimit?: number | null;
  quizCooldownInHours?: number | null;
  questions?: {
    /** @format uuid */
    id?: string;
    type:
      | "brief_response"
      | "detailed_response"
      | "match_words"
      | "scale_1_5"
      | "single_choice"
      | "multiple_choice"
      | "true_or_false"
      | "photo_question_single_choice"
      | "photo_question_multiple_choice"
      | "fill_in_the_blanks_text"
      | "fill_in_the_blanks_dnd";
    description?: string | null;
    title: string;
    displayOrder?: number;
    solutionExplanation?: string;
    photoS3Key?: string | null;
    options?: {
      /** @format uuid */
      id?: string;
      /** @maxLength 250 */
      optionText: string;
      displayOrder: number | null;
      isStudentAnswer?: boolean | null;
      isCorrect: boolean;
      /** @format uuid */
      questionId?: string;
      matchedWord?: string | null;
      scaleAnswer?: number | null;
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    /** @default "en" */
    language?: "en" | "pl";
  }[];
} & {
  /** @format uuid */
  chapterId?: string;
  displayOrder?: number;
}) & {
  /** @default "en" */
  language: "en" | "pl";
};

export interface BetaUpdateQuizLessonResponse {
  data: {
    message: string;
  };
}

export type BetaUpdateLessonBody = ({
  title?: string;
  type?: "text" | "presentation" | "video" | "quiz" | "ai_mentor" | "embed";
  description?: string | null;
  fileS3Key?: string | null;
  avatarReferenceUrl?: string;
  fileType?: string | null;
  questions?: {
    /** @format uuid */
    id?: string;
    type:
      | "brief_response"
      | "detailed_response"
      | "match_words"
      | "scale_1_5"
      | "single_choice"
      | "multiple_choice"
      | "true_or_false"
      | "photo_question_single_choice"
      | "photo_question_multiple_choice"
      | "fill_in_the_blanks_text"
      | "fill_in_the_blanks_dnd";
    description?: string | null;
    title: string;
    displayOrder?: number;
    solutionExplanation?: string;
    photoS3Key?: string | null;
    options?: {
      /** @format uuid */
      id?: string;
      /** @maxLength 250 */
      optionText: string;
      displayOrder: number | null;
      isStudentAnswer?: boolean | null;
      isCorrect: boolean;
      /** @format uuid */
      questionId?: string;
      matchedWord?: string | null;
      scaleAnswer?: number | null;
      /** @default "en" */
      language?: "en" | "pl";
    }[];
    /** @default "en" */
    language?: "en" | "pl";
  }[];
  aiMentor?: {
    /** @format uuid */
    id: string;
    /** @format uuid */
    lessonId: string;
    aiMentorInstructions: string;
    completionConditions: string;
    type: "mentor" | "teacher" | "roleplay";
    avatarReference: string | null;
  } | null;
  updatedAt?: string;
} & {
  /** @format uuid */
  chapterId?: string;
  displayOrder?: number;
}) & {
  /** @default "en" */
  language: "en" | "pl";
};

export interface BetaUpdateLessonResponse {
  data: {
    message: string;
  };
}

export interface RemoveLessonResponse {
  data: {
    message: string;
  };
}

export interface EvaluationQuizBody {
  /** @format uuid */
  lessonId: string;
  questionsAnswers: {
    /** @format uuid */
    questionId: string;
    answers: (
      | {
          /** @format uuid */
          answerId: string;
        }
      | {
          value: string;
        }
      | {
          /** @format uuid */
          answerId: string;
          value: string;
        }
    )[];
  }[];
  language: "en" | "pl";
}

export interface EvaluationQuizResponse {
  data: {
    message: string;
    data: {
      correctAnswerCount: number;
      wrongAnswerCount: number;
      questionCount: number;
      score: number;
    };
  };
}

export interface DeleteStudentQuizAnswersResponse {
  data: {
    message: string;
  };
}

export interface CreateEmbedLessonBody {
  title: string;
  type: "embed";
  /** @format uuid */
  chapterId: string;
  resources: {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    /** @maxLength 1000 */
    source: string;
    isExternal?: boolean;
    displayOrder?: number;
    allowFullscreen?: boolean;
    /** @maxLength 50 */
    type?: string;
  }[];
}

export interface CreateEmbedLessonResponse {
  data: {
    message: string;
  };
}

export interface UpdateEmbedLessonBody {
  title: string;
  type: "embed";
  resources: {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
    /** @maxLength 1000 */
    source: string;
    isExternal?: boolean;
    displayOrder?: number;
    allowFullscreen?: boolean;
    /** @maxLength 50 */
    type?: string;
  }[];
  /** @format uuid */
  lessonId: string;
  /** @default "en" */
  language: "en" | "pl";
}

export interface UpdateEmbedLessonResponse {
  data: {
    message: string;
  };
}

export interface UpdateLessonDisplayOrderBody {
  /** @format uuid */
  lessonId: string;
  displayOrder: number;
}

export interface UpdateLessonDisplayOrderResponse {
  data: {
    message: string;
  };
}

export interface MarkLessonAsCompletedResponse {
  data: {
    message: string;
  };
}

export interface GetAllCertificatesResponse {
  data: {
    /** @format uuid */
    id: string;
    /** @format uuid */
    userId: string;
    /** @format uuid */
    courseId: string;
    courseTitle?: string | null;
    completionDate?: string | null;
    fullName?: string | null;
    createdAt: string;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export type GetCertificateResponse = {
  /** @format uuid */
  id: string;
  /** @format uuid */
  userId: string;
  /** @format uuid */
  courseId: string;
  courseTitle?: string | null;
  completionDate?: string | null;
  fullName?: string | null;
  createdAt: string;
}[];

export interface DownloadCertificateBody {
  html: string;
  filename?: string;
}

export interface GetThreadResponse {
  data: {
    /** @format uuid */
    id: string;
    /** @format uuid */
    aiMentorLessonId: string;
    /** @format uuid */
    userId: string;
    userLanguage: "en" | "pl";
    createdAt: string;
    updatedAt: string;
    status: "active" | "completed" | "archived";
  };
}

export interface GetThreadMessagesResponse {
  data: (({
    content: string;
  } & {
    role: "system" | "user" | "assistant" | "tool" | "summary";
    isJudge?: boolean;
    userName?: string | null;
  }) & {
    id: string;
  })[];
}

export interface StreamChatBody {
  /** @format uuid */
  threadId: string;
  /** @minLength 1 */
  content: string;
  /** @format uuid */
  id?: string;
}

export interface JudgeThreadResponse {
  data: {
    summary: string;
    passed: boolean;
  };
}

export interface GetAllAssignedDocumentsForLessonResponse {
  data: {
    /** @format uuid */
    id: string;
    name: string;
    type: string;
    size: number;
  }[];
}

export interface CreatePaymentIntentResponse {
  data: {
    clientSecret: string;
  };
}

export interface CreateCheckoutSessionBody {
  amountInCents: number;
  allowPromotionCode?: boolean;
  quantity?: number;
  productName: string;
  productDescription?: string;
  courseId: string;
  customerId: string;
  locale?: string;
  priceId: string;
}

export interface CreateCheckoutSessionResponse {
  data: {
    clientSecret: string;
  };
}

export interface GetPromotionCodesResponse {
  data: {
    id: string;
    active: boolean;
    code: string;
    coupon: {
      id: string;
      amountOff?: number | null;
      percentOff?: number | null;
      created: number;
      currency?: string | null;
      duration: string;
      durationInMonths?: number | null;
      maxRedemptions?: number | null;
      metadata?: Record<string, any>;
      name?: string | null;
      redeemBy?: number | null;
      timesRedeemed: number;
      valid: boolean;
      appliesTo: string[];
    };
    created: number;
    customer?: string | null;
    expiresAt?: number | null;
    maxRedemptions?: number | null;
    metadata?: Record<string, any>;
    restrictions: {
      firstTimeTransaction: boolean;
      minimumAmount?: number | null;
      minimumAmountCurrency?: string | null;
    };
    timesRedeemed: number;
  }[];
}

export interface GetPromotionCodeResponse {
  data: {
    id: string;
    active: boolean;
    code: string;
    coupon: {
      id: string;
      amountOff?: number | null;
      percentOff?: number | null;
      created: number;
      currency?: string | null;
      duration: string;
      durationInMonths?: number | null;
      maxRedemptions?: number | null;
      metadata?: Record<string, any>;
      name?: string | null;
      redeemBy?: number | null;
      timesRedeemed: number;
      valid: boolean;
      appliesTo: string[];
    };
    created: number;
    customer?: string | null;
    expiresAt?: number | null;
    maxRedemptions?: number | null;
    metadata?: Record<string, any>;
    restrictions: {
      firstTimeTransaction: boolean;
      minimumAmount?: number | null;
      minimumAmountCurrency?: string | null;
    };
    timesRedeemed: number;
  };
}

export interface CreatePromotionCouponBody {
  code: string;
  amountOff?: number;
  percentOff?: number;
  maxRedemptions?: number;
  assignedStripeCourseIds?: string[];
  currency?: string;
  expiresAt?: string;
  courseId?: string[];
}

export interface CreatePromotionCouponResponse {
  data: string;
}

export interface UpdatePromotionCodeBody {
  active?: boolean;
}

export interface UpdatePromotionCodeResponse {
  data: {
    id: string;
    active: boolean;
    code: string;
    coupon: {
      id: string;
      amountOff?: number | null;
      percentOff?: number | null;
      created: number;
      currency?: string | null;
      duration: string;
      durationInMonths?: number | null;
      maxRedemptions?: number | null;
      metadata?: Record<string, any>;
      name?: string | null;
      redeemBy?: number | null;
      timesRedeemed: number;
      valid: boolean;
      appliesTo: string[];
    };
    created: number;
    customer?: string | null;
    expiresAt?: number | null;
    maxRedemptions?: number | null;
    metadata?: Record<string, any>;
    restrictions: {
      firstTimeTransaction: boolean;
      minimumAmount?: number | null;
      minimumAmountCurrency?: string | null;
    };
    timesRedeemed: number;
  };
}

export interface GetAllCategoriesResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    archived: boolean | null;
    createdAt: string | null;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetCategoryByIdResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    archived: boolean | null;
    createdAt: string | null;
  };
}

export interface CreateCategoryBody {
  title: string;
}

export interface CreateCategoryResponse {
  data: {
    /** @format uuid */
    id: string;
    message: string;
  };
}

export interface UpdateCategoryBody {
  /** @format uuid */
  id?: string;
  title?: string;
  archived?: boolean;
}

export interface UpdateCategoryResponse {
  data: {
    /** @format uuid */
    id: string;
    title: string;
    archived: boolean | null;
    createdAt: string | null;
  };
}

export interface DeleteCategoryResponse {
  data: {
    message: string;
  };
}

export type DeleteManyCategoriesBody = string[];

export interface DeleteManyCategoriesResponse {
  data: {
    message: string;
  };
}

export interface UploadScormPackageResponse {
  data: {
    message: string;
    metadata: {
      /** @format uuid */
      id: string;
      createdAt: string;
      updatedAt: string;
      /** @format uuid */
      courseId: string;
      /** @format uuid */
      fileId: string;
      version: string;
      entryPoint: string;
      s3Key: string;
    };
  };
}

export interface GetScormMetadataResponse {
  data: {
    /** @format uuid */
    id: string;
    createdAt: string;
    updatedAt: string;
    /** @format uuid */
    courseId: string;
    /** @format uuid */
    fileId: string;
    version: string;
    entryPoint: string;
    s3Key: string;
  };
}

export interface GetAllAnnouncementsResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    content: string;
    authorId: string;
    isEveryone: boolean;
    authorName: string;
    authorProfilePictureUrl: string | null;
  }[];
}

export interface GetLatestUnreadAnnouncementsResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    content: string;
    authorId: string;
    isEveryone: boolean;
    authorName: string;
    authorProfilePictureUrl: string | null;
  }[];
}

export interface GetUnreadAnnouncementsCountResponse {
  data: {
    unreadCount: number;
  };
}

export interface GetAnnouncementsForUserResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    content: string;
    authorId: string;
    isEveryone: boolean;
    authorName: string;
    authorProfilePictureUrl: string | null;
    isRead: boolean;
  }[];
}

export interface CreateAnnouncementBody {
  /**
   * @minLength 1
   * @maxLength 120
   */
  title: string;
  /** @minLength 1 */
  content: string;
  /** @default null */
  groupId: string | null;
}

export interface CreateAnnouncementResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    content: string;
    authorId: string;
    isEveryone: boolean;
  };
}

export interface MarkAnnouncementAsReadResponse {
  data: {
    id: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    announcementId: string;
    isRead: boolean;
    readAt: string | null;
  };
}

export interface GetEnvKeyResponse {
  data: {
    name: string;
    value: string;
  };
}

export type BulkUpsertEnvBody = {
  name: string;
  value: string;
}[];

export interface GetFrontendSSOEnabledResponse {
  data: {
    google?: string;
    microsoft?: string;
    slack?: string;
  };
}

export interface GetStripePublishableKeyResponse {
  data: {
    publishableKey: string | null;
  };
}

export interface GetStripeConfiguredResponse {
  data: {
    enabled: boolean;
  };
}

export interface GetIsConfigSetupResponse {
  data: {
    fullyConfigured: string[];
    partiallyConfigured: {
      service: string;
      missingKeys: string[];
    }[];
    notConfigured: {
      service: string;
      missingKeys: string[];
    }[];
    hasIssues: boolean;
    isWarningDismissed: boolean;
  };
}

export interface GetQAResponse {
  /** @format uuid */
  id: string;
  title: string | null;
  description: string | null;
  baseLanguage: "en" | "pl";
  availableLocales: ("en" | "pl")[];
}

export type GetAllQAResponse = {
  /** @format uuid */
  id: string;
  title: string | null;
  description: string | null;
  baseLanguage: "en" | "pl";
  availableLocales: ("en" | "pl")[];
}[];

export interface CreateQABody {
  title: string;
  description: string;
  language: "en" | "pl";
}

export interface UpdateQABody {
  title?: string;
  description?: string;
}

export interface GetDraftNewsListResponse {
  data: {
    id: string;
    title: string;
    content: string;
    summary: string;
    status: string;
    isPublic: boolean;
    publishedAt: string | null;
    authorName: string;
    resources?: {
      images: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      videos: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      attachments: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      coverImage?: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      };
    };
    createdAt: string;
    updatedAt: string;
    nextNews?: string | null;
    previousNews?: string | null;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface GetNewsResponse {
  data: {
    id: string;
    title: string;
    content: string;
    summary: string;
    status: string;
    isPublic: boolean;
    publishedAt: string | null;
    authorName: string;
    resources?: {
      images: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      videos: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      attachments: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      coverImage?: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      };
    };
    createdAt: string;
    updatedAt: string;
    nextNews?: string | null;
    previousNews?: string | null;
  };
}

export interface GetNewsListResponse {
  data: {
    id: string;
    title: string;
    content: string;
    summary: string;
    status: string;
    isPublic: boolean;
    publishedAt: string | null;
    authorName: string;
    resources?: {
      images: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      videos: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      attachments: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      }[];
      coverImage?: {
        /** @format uuid */
        id: string;
        fileUrl: string;
        contentType: string;
        title?: string;
        description?: string;
        fileName?: string;
      };
    };
    createdAt: string;
    updatedAt: string;
    nextNews?: string | null;
    previousNews?: string | null;
  }[];
  pagination: {
    totalItems: number;
    page: number;
    perPage: number;
  };
  appliedFilters?: object;
}

export interface CreateNewsBody {
  /** @default "en" */
  language: "en" | "pl";
}

export interface CreateNewsResponse {
  data: {
    id: string;
    title: string;
  };
}

export interface UpdateNewsBody {
  /** @default "en" */
  language: "en" | "pl";
  /**
   * @minLength 1
   * @maxLength 200
   */
  title?: string;
  /** @maxLength 500 */
  summary?: string;
  content?: string;
  status?: "draft" | "published" | "";
  isPublic?: boolean | "true" | "false" | "";
  /**
   * Cover image file
   * @format binary
   */
  cover?: File;
}

export interface UpdateNewsResponse {
  data: {
    id: string;
    title: string;
  };
}

export interface AddNewLanguageBody {
  /** @default "en" */
  language: "en" | "pl";
}

export interface AddNewLanguageResponse {
  data: {
    id: string;
    title: string;
  };
}

export interface DeleteNewsLanguageResponse {
  data: {
    /** @format uuid */
    id: string;
    availableLocales: string[];
  };
}

export interface DeleteNewsResponse {
  data: {
    /** @format uuid */
    id: string;
  };
}

export interface UploadFileToNewsResponse {
  data: {
    /** @format uuid */
    resourceId: string;
  };
}

import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  HeadersDefaults,
  ResponseType,
} from "axios";
import axios from "axios";

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams
  extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseType;
  /** request body */
  body?: unknown;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown>
  extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public instance: AxiosInstance;
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private secure?: boolean;
  private format?: ResponseType;

  constructor({
    securityWorker,
    secure,
    format,
    ...axiosConfig
  }: ApiConfig<SecurityDataType> = {}) {
    this.instance = axios.create({ ...axiosConfig, baseURL: axiosConfig.baseURL || "" });
    this.secure = secure;
    this.format = format;
    this.securityWorker = securityWorker;
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected mergeRequestParams(
    params1: AxiosRequestConfig,
    params2?: AxiosRequestConfig,
  ): AxiosRequestConfig {
    const method = params1.method || (params2 && params2.method);

    return {
      ...this.instance.defaults,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...((method &&
          this.instance.defaults.headers[method.toLowerCase() as keyof HeadersDefaults]) ||
          {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected stringifyFormItem(formItem: unknown) {
    if (typeof formItem === "object" && formItem !== null) {
      return JSON.stringify(formItem);
    } else {
      return `${formItem}`;
    }
  }

  protected createFormData(input: Record<string, unknown>): FormData {
    if (input instanceof FormData) {
      return input;
    }
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];
      const propertyContent: any[] = property instanceof Array ? property : [property];

      for (const formItem of propertyContent) {
        const isFileType = formItem instanceof Blob || formItem instanceof File;
        formData.append(key, isFileType ? formItem : this.stringifyFormItem(formItem));
      }

      return formData;
    }, new FormData());
  }

  public request = async <T = any, _E = any>({
    secure,
    path,
    type,
    query,
    format,
    body,
    ...params
  }: FullRequestParams): Promise<AxiosResponse<T>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = format || this.format || undefined;

    if (type === ContentType.FormData && body && body !== null && typeof body === "object") {
      body = this.createFormData(body as Record<string, unknown>);
    }

    if (type === ContentType.Text && body && body !== null && typeof body !== "string") {
      body = JSON.stringify(body);
    }

    return this.instance.request({
      ...requestParams,
      headers: {
        ...(requestParams.headers || {}),
        ...(type ? { "Content-Type": type } : {}),
      },
      params: query,
      responseType: responseFormat,
      data: body,
      url: path,
    });
  };
}

/**
 * @title Guidebook API
 * @version 1.0
 * @contact
 *
 * Example usage of Swagger with Typebox
 */
export class API<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  api = {
    /**
     * No description
     *
     * @name AuthControllerRegister
     * @request POST:/api/auth/register
     */
    authControllerRegister: (data: RegisterBody, params: RequestParams = {}) =>
      this.request<RegisterResponse, any>({
        path: `/api/auth/register`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerLogin
     * @request POST:/api/auth/login
     */
    authControllerLogin: (data: LoginBody, params: RequestParams = {}) =>
      this.request<LoginResponse, any>({
        path: `/api/auth/login`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerLogout
     * @request POST:/api/auth/logout
     */
    authControllerLogout: (params: RequestParams = {}) =>
      this.request<LogoutResponse, any>({
        path: `/api/auth/logout`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerRefreshTokens
     * @request POST:/api/auth/refresh
     */
    authControllerRefreshTokens: (params: RequestParams = {}) =>
      this.request<RefreshTokensResponse, any>({
        path: `/api/auth/refresh`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerCurrentUser
     * @request GET:/api/auth/current-user
     */
    authControllerCurrentUser: (params: RequestParams = {}) =>
      this.request<CurrentUserResponse, any>({
        path: `/api/auth/current-user`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerForgotPassword
     * @request POST:/api/auth/forgot-password
     */
    authControllerForgotPassword: (data: ForgotPasswordBody, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/forgot-password`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerCreatePassword
     * @request POST:/api/auth/create-password
     */
    authControllerCreatePassword: (data: CreatePasswordBody, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/create-password`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerResetPassword
     * @request POST:/api/auth/reset-password
     */
    authControllerResetPassword: (data: ResetPasswordBody, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/reset-password`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerGoogleAuth
     * @request GET:/api/auth/google
     */
    authControllerGoogleAuth: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/google`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerGoogleAuthCallback
     * @request GET:/api/auth/google/callback
     */
    authControllerGoogleAuthCallback: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/google/callback`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerMicrosoftAuth
     * @request GET:/api/auth/microsoft
     */
    authControllerMicrosoftAuth: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/microsoft`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerMicrosoftAuthCallback
     * @request GET:/api/auth/microsoft/callback
     */
    authControllerMicrosoftAuthCallback: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/microsoft/callback`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerSlackAuth
     * @request GET:/api/auth/slack
     */
    authControllerSlackAuth: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/slack`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerSlackAuthCallback
     * @request GET:/api/auth/slack/callback
     */
    authControllerSlackAuthCallback: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/slack/callback`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerMfaSetup
     * @request POST:/api/auth/mfa/setup
     */
    authControllerMfaSetup: (params: RequestParams = {}) =>
      this.request<MFASetupResponse, any>({
        path: `/api/auth/mfa/setup`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AuthControllerMfaVerify
     * @request POST:/api/auth/mfa/verify
     */
    authControllerMfaVerify: (data: MFAVerifyBody, params: RequestParams = {}) =>
      this.request<MFAVerifyResponse, any>({
        path: `/api/auth/mfa/verify`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerGetPublicGlobalSettings
     * @request GET:/api/settings/global
     */
    settingsControllerGetPublicGlobalSettings: (params: RequestParams = {}) =>
      this.request<GetPublicGlobalSettingsResponse, any>({
        path: `/api/settings/global`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerGetUserSettings
     * @request GET:/api/settings
     */
    settingsControllerGetUserSettings: (params: RequestParams = {}) =>
      this.request<GetUserSettingsResponse, any>({
        path: `/api/settings`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateUserSettings
     * @request PUT:/api/settings
     */
    settingsControllerUpdateUserSettings: (
      data: UpdateUserSettingsBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateUserSettingsResponse, any>({
        path: `/api/settings`,
        method: "PUT",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateAdminNewUserNotification
     * @request PATCH:/api/settings/admin/new-user-notification
     */
    settingsControllerUpdateAdminNewUserNotification: (params: RequestParams = {}) =>
      this.request<UpdateAdminNewUserNotificationResponse, any>({
        path: `/api/settings/admin/new-user-notification`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateUnregisteredUserCoursesAccessibility
     * @request PATCH:/api/settings/admin/unregistered-user-courses-accessibility
     */
    settingsControllerUpdateUnregisteredUserCoursesAccessibility: (params: RequestParams = {}) =>
      this.request<UpdateUnregisteredUserCoursesAccessibilityResponse, any>({
        path: `/api/settings/admin/unregistered-user-courses-accessibility`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateEnforceSso
     * @request PATCH:/api/settings/admin/enforce-sso
     */
    settingsControllerUpdateEnforceSso: (params: RequestParams = {}) =>
      this.request<UpdateEnforceSSOResponse, any>({
        path: `/api/settings/admin/enforce-sso`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateAdminFinishedCourseNotification
     * @request PATCH:/api/settings/admin/finished-course-notification
     */
    settingsControllerUpdateAdminFinishedCourseNotification: (params: RequestParams = {}) =>
      this.request<UpdateAdminFinishedCourseNotificationResponse, any>({
        path: `/api/settings/admin/finished-course-notification`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateColorSchema
     * @request PATCH:/api/settings/admin/color-schema
     */
    settingsControllerUpdateColorSchema: (
      data: UpdateColorSchemaBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateColorSchemaResponse, any>({
        path: `/api/settings/admin/color-schema`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerGetPlatformLogo
     * @request GET:/api/settings/platform-logo
     */
    settingsControllerGetPlatformLogo: (params: RequestParams = {}) =>
      this.request<GetPlatformLogoResponse, any>({
        path: `/api/settings/platform-logo`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdatePlatformLogo
     * @request PATCH:/api/settings/platform-logo
     */
    settingsControllerUpdatePlatformLogo: (
      data: {
        /** @format binary */
        logo?: File | null;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/platform-logo`,
        method: "PATCH",
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerGetPlatformSimpleLogo
     * @request GET:/api/settings/platform-simple-logo
     */
    settingsControllerGetPlatformSimpleLogo: (params: RequestParams = {}) =>
      this.request<GetPlatformSimpleLogoResponse, any>({
        path: `/api/settings/platform-simple-logo`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdatePlatformSimpleLogo
     * @request PATCH:/api/settings/platform-simple-logo
     */
    settingsControllerUpdatePlatformSimpleLogo: (
      data: {
        /** @format binary */
        logo?: File | null;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/platform-simple-logo`,
        method: "PATCH",
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerGetLoginBackground
     * @request GET:/api/settings/login-background
     */
    settingsControllerGetLoginBackground: (params: RequestParams = {}) =>
      this.request<GetLoginBackgroundResponse, any>({
        path: `/api/settings/login-background`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateLoginBackground
     * @request PATCH:/api/settings/login-background
     */
    settingsControllerUpdateLoginBackground: (
      data: {
        /** @format binary */
        "login-background"?: File | null;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/login-background`,
        method: "PATCH",
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerGetCompanyInformation
     * @request GET:/api/settings/company-information
     */
    settingsControllerGetCompanyInformation: (params: RequestParams = {}) =>
      this.request<GetCompanyInformationResponse, any>({
        path: `/api/settings/company-information`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateCompanyInformation
     * @request PATCH:/api/settings/company-information
     */
    settingsControllerUpdateCompanyInformation: (
      data: UpdateCompanyInformationBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateCompanyInformationResponse, any>({
        path: `/api/settings/company-information`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateMfaEnforcedRoles
     * @request PATCH:/api/settings/admin/mfa-enforced-roles
     */
    settingsControllerUpdateMfaEnforcedRoles: (
      data: UpdateMFAEnforcedRolesBody,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/admin/mfa-enforced-roles`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateCertificateBackground
     * @request PATCH:/api/settings/certificate-background
     */
    settingsControllerUpdateCertificateBackground: (
      data: {
        /** @format binary */
        "certificate-background"?: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/certificate-background`,
        method: "PATCH",
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateDefaultCourseCurrency
     * @request PATCH:/api/settings/admin/default-course-currency
     */
    settingsControllerUpdateDefaultCourseCurrency: (
      data: UpdateDefaultCourseCurrencyBody,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/admin/default-course-currency`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateInviteOnlyRegistration
     * @request PATCH:/api/settings/admin/invite-only-registration
     */
    settingsControllerUpdateInviteOnlyRegistration: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/settings/admin/invite-only-registration`,
        method: "PATCH",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateUserEmailTriggers
     * @request PATCH:/api/settings/admin/user-email-triggers/{triggerKey}
     */
    settingsControllerUpdateUserEmailTriggers: (triggerKey: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/settings/admin/user-email-triggers/${triggerKey}`,
        method: "PATCH",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateConfigWarningDismissed
     * @request PATCH:/api/settings/admin/config-warning-dismissed
     */
    settingsControllerUpdateConfigWarningDismissed: (
      data: UpdateConfigWarningDismissedBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateConfigWarningDismissedResponse, any>({
        path: `/api/settings/admin/config-warning-dismissed`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name SettingsControllerUpdateQaSetting
     * @request PATCH:/api/settings/admin/qa/{setting}
     */
    settingsControllerUpdateQaSetting: (
      setting: "QAEnabled" | "unregisteredUserQAAccessibility",
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/settings/admin/qa/${setting}`,
        method: "PATCH",
        ...params,
      }),

    /**
     * No description
     *
     * @name FileControllerUploadFile
     * @request POST:/api/file
     */
    fileControllerUploadFile: (
      data: {
        /** @format binary */
        file?: File;
        /** Optional resource type */
        resource?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<FileUploadResponse, any>({
        path: `/api/file`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name FileControllerDeleteFile
     * @request DELETE:/api/file
     */
    fileControllerDeleteFile: (
      query: {
        /** Key of the file to delete */
        fileKey: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/file`,
        method: "DELETE",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @name StatisticsControllerGetUserStatistics
     * @request GET:/api/statistics/user-stats
     */
    statisticsControllerGetUserStatistics: (
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetUserStatisticsResponse, any>({
        path: `/api/statistics/user-stats`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StatisticsControllerGetStats
     * @request GET:/api/statistics/stats
     */
    statisticsControllerGetStats: (
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetStatsResponse, any>({
        path: `/api/statistics/stats`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerGetUsers
     * @request GET:/api/user/all
     */
    userControllerGetUsers: (
      query?: {
        keyword?: string;
        role?: "admin" | "student" | "content_creator";
        archived?: string;
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?:
          | "firstName"
          | "lastName"
          | "email"
          | "createdAt"
          | "groupName"
          | "-firstName"
          | "-lastName"
          | "-email"
          | "-createdAt"
          | "-groupName";
        groups?: string[];
      },
      params: RequestParams = {},
    ) =>
      this.request<GetUsersResponse, any>({
        path: `/api/user/all`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerGetUserById
     * @request GET:/api/user
     */
    userControllerGetUserById: (
      query: {
        /** @format uuid */
        id: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetUserByIdResponse, any>({
        path: `/api/user`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerUpdateUser
     * @request PATCH:/api/user
     */
    userControllerUpdateUser: (
      query: {
        /** @format uuid */
        id: string;
      },
      data: UpdateUserBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateUserResponse, any>({
        path: `/api/user`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerDeleteBulkUsers
     * @request DELETE:/api/user
     */
    userControllerDeleteBulkUsers: (data: DeleteBulkUsersBody, params: RequestParams = {}) =>
      this.request<DeleteBulkUsersResponse, any>({
        path: `/api/user`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerCreateUser
     * @request POST:/api/user
     */
    userControllerCreateUser: (data: CreateUserBody, params: RequestParams = {}) =>
      this.request<CreateUserResponse, any>({
        path: `/api/user`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerGetUserDetails
     * @request GET:/api/user/details
     */
    userControllerGetUserDetails: (
      query: {
        /** @format uuid */
        userId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetUserDetailsResponse, any>({
        path: `/api/user/details`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerUpsertUserDetails
     * @request PATCH:/api/user/details
     */
    userControllerUpsertUserDetails: (data: UpsertUserDetailsBody, params: RequestParams = {}) =>
      this.request<UpsertUserDetailsResponse, any>({
        path: `/api/user/details`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerUpdateUserProfile
     * @request PATCH:/api/user/profile
     */
    userControllerUpdateUserProfile: (
      data: {
        /** @format binary */
        userAvatar?: File;
        /** @format string */
        data?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/user/profile`,
        method: "PATCH",
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerAdminUpdateUser
     * @request PATCH:/api/user/admin
     */
    userControllerAdminUpdateUser: (
      query: {
        /** @format uuid */
        id: string;
      },
      data: AdminUpdateUserBody,
      params: RequestParams = {},
    ) =>
      this.request<AdminUpdateUserResponse, any>({
        path: `/api/user/admin`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerChangePassword
     * @request PATCH:/api/user/change-password
     */
    userControllerChangePassword: (
      query: {
        /** @format uuid */
        id: string;
      },
      data: ChangePasswordBody,
      params: RequestParams = {},
    ) =>
      this.request<ChangePasswordResponse, any>({
        path: `/api/user/change-password`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerBulkAssignUsersToGroup
     * @request PATCH:/api/user/bulk/groups
     */
    userControllerBulkAssignUsersToGroup: (
      data: BulkAssignUsersToGroupBody,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/user/bulk/groups`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerArchiveBulkUsers
     * @request PATCH:/api/user/bulk/archive
     */
    userControllerArchiveBulkUsers: (data: ArchiveBulkUsersBody, params: RequestParams = {}) =>
      this.request<ArchiveBulkUsersResponse, any>({
        path: `/api/user/bulk/archive`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerImportUsers
     * @request POST:/api/user/import
     */
    userControllerImportUsers: (
      data: {
        /** @format binary */
        usersFile?: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<ImportUsersResponse, any>({
        path: `/api/user/import`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerResetOnboardingStatus
     * @request PATCH:/api/user/onboarding-status/reset
     */
    userControllerResetOnboardingStatus: (params: RequestParams = {}) =>
      this.request<ResetOnboardingStatusResponse, any>({
        path: `/api/user/onboarding-status/reset`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name UserControllerMarkOnboardingComplete
     * @request PATCH:/api/user/onboarding-status/{page}
     */
    userControllerMarkOnboardingComplete: (page: string, params: RequestParams = {}) =>
      this.request<MarkOnboardingCompleteResponse, any>({
        path: `/api/user/onboarding-status/${page}`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerGetAllGroups
     * @request GET:/api/group/all
     */
    groupControllerGetAllGroups: (
      query?: {
        keyword?: string;
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAllGroupsResponse, any>({
        path: `/api/group/all`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerGetGroupById
     * @request GET:/api/group/{groupId}
     */
    groupControllerGetGroupById: (groupId: string, params: RequestParams = {}) =>
      this.request<GetGroupByIdResponse, any>({
        path: `/api/group/${groupId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerUpdateGroup
     * @request PATCH:/api/group/{groupId}
     */
    groupControllerUpdateGroup: (
      groupId: string,
      data: UpdateGroupBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateGroupResponse, any>({
        path: `/api/group/${groupId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerDeleteGroup
     * @request DELETE:/api/group/{groupId}
     */
    groupControllerDeleteGroup: (groupId: string, params: RequestParams = {}) =>
      this.request<DeleteGroupResponse, any>({
        path: `/api/group/${groupId}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerGetUserGroups
     * @request GET:/api/group/user/{userId}
     */
    groupControllerGetUserGroups: (
      userId: string,
      query?: {
        keyword?: string;
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetUserGroupsResponse, any>({
        path: `/api/group/user/${userId}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerCreateGroup
     * @request POST:/api/group
     */
    groupControllerCreateGroup: (data: CreateGroupBody, params: RequestParams = {}) =>
      this.request<CreateGroupResponse, any>({
        path: `/api/group`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerBulkDeleteGroups
     * @request DELETE:/api/group
     */
    groupControllerBulkDeleteGroups: (data: BulkDeleteGroupsBody, params: RequestParams = {}) =>
      this.request<BulkDeleteGroupsResponse, any>({
        path: `/api/group`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerSetUserGroups
     * @request POST:/api/group/set
     */
    groupControllerSetUserGroups: (
      data: GroupIds,
      query?: {
        /** @format uuid */
        userId?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<SetUserGroupsResponse, any>({
        path: `/api/group/set`,
        method: "POST",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name GroupControllerGetGroupsByCourse
     * @request GET:/api/group/by-course/{courseId}
     */
    groupControllerGetGroupsByCourse: (courseId: string, params: RequestParams = {}) =>
      this.request<GetGroupsByCourseResponse, any>({
        path: `/api/group/by-course/${courseId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetAllCourses
     * @request GET:/api/course/all
     */
    courseControllerGetAllCourses: (
      query?: {
        title?: string;
        description?: string;
        searchQuery?: string;
        category?: string;
        author?: string;
        creationDateRange?: string[];
        status?: "draft" | "published" | "private";
        sort?:
          | "title"
          | "category"
          | "creationDate"
          | "author"
          | "chapterCount"
          | "enrolledParticipantsCount"
          | "-title"
          | "-category"
          | "-creationDate"
          | "-author"
          | "-chapterCount"
          | "-enrolledParticipantsCount";
        /** @min 1 */
        page?: number;
        perPage?: number;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAllCoursesResponse, any>({
        path: `/api/course/all`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetStudentCourses
     * @request GET:/api/course/get-student-courses
     */
    courseControllerGetStudentCourses: (
      query?: {
        title?: string;
        description?: string;
        searchQuery?: string;
        category?: string;
        author?: string;
        "creationDateRange[0]"?: string;
        "creationDateRange[1]"?: string;
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?:
          | "title"
          | "category"
          | "creationDate"
          | "author"
          | "chapterCount"
          | "enrolledParticipantsCount"
          | "-title"
          | "-category"
          | "-creationDate"
          | "-author"
          | "-chapterCount"
          | "-enrolledParticipantsCount";
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetStudentCoursesResponse, any>({
        path: `/api/course/get-student-courses`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetStudentsWithEnrollmentDate
     * @request GET:/api/course/{courseId}/students
     */
    courseControllerGetStudentsWithEnrollmentDate: (
      courseId: string,
      query?: {
        keyword?: string;
        sort?:
          | "enrolledAt"
          | "firstName"
          | "lastName"
          | "email"
          | "isEnrolledByGroup"
          | "-enrolledAt"
          | "-firstName"
          | "-lastName"
          | "-email"
          | "-isEnrolledByGroup";
        groups?: string[];
        /** @min 1 */
        page?: number;
        perPage?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetStudentsWithEnrollmentDateResponse, any>({
        path: `/api/course/${courseId}/students`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetAvailableCourses
     * @request GET:/api/course/available-courses
     */
    courseControllerGetAvailableCourses: (
      query?: {
        title?: string;
        description?: string;
        searchQuery?: string;
        category?: string;
        author?: string;
        "creationDateRange[0]"?: string;
        "creationDateRange[1]"?: string;
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?:
          | "title"
          | "category"
          | "creationDate"
          | "author"
          | "chapterCount"
          | "enrolledParticipantsCount"
          | "-title"
          | "-category"
          | "-creationDate"
          | "-author"
          | "-chapterCount"
          | "-enrolledParticipantsCount";
        /** @format uuid */
        excludeCourseId?: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAvailableCoursesResponse, any>({
        path: `/api/course/available-courses`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetContentCreatorCourses
     * @request GET:/api/course/content-creator-courses
     */
    courseControllerGetContentCreatorCourses: (
      query: {
        /** @format uuid */
        authorId: string;
        scope?: "all" | "enrolled" | "available";
        /** @format uuid */
        excludeCourseId?: string;
        title?: string;
        description?: string;
        searchQuery?: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetContentCreatorCoursesResponse, any>({
        path: `/api/course/content-creator-courses`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetCourse
     * @request GET:/api/course
     */
    courseControllerGetCourse: (
      query: {
        /** @format uuid */
        id: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetCourseResponse, any>({
        path: `/api/course`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerCreateCourse
     * @request POST:/api/course
     */
    courseControllerCreateCourse: (data: CreateCourseBody, params: RequestParams = {}) =>
      this.request<CreateCourseResponse, any>({
        path: `/api/course`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetBetaCourseById
     * @request GET:/api/course/beta-course-by-id
     */
    courseControllerGetBetaCourseById: (
      query: {
        /** @format uuid */
        id: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetBetaCourseByIdResponse, any>({
        path: `/api/course/beta-course-by-id`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerUpdateCourse
     * @request PATCH:/api/course/{id}
     */
    courseControllerUpdateCourse: (
      id: string,
      data: UpdateCourseBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateCourseResponse, any>({
        path: `/api/course/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerUpdateHasCertificate
     * @request PATCH:/api/course/update-has-certificate/{id}
     */
    courseControllerUpdateHasCertificate: (
      id: string,
      data: UpdateHasCertificateBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateHasCertificateResponse, any>({
        path: `/api/course/update-has-certificate/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerUpdateLessonSequenceEnabled
     * @request PATCH:/api/course/update-lesson-sequence/{courseId}
     */
    courseControllerUpdateLessonSequenceEnabled: (
      courseId: string,
      data: UpdateLessonSequenceEnabledBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateLessonSequenceEnabledResponse, any>({
        path: `/api/course/update-lesson-sequence/${courseId}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetLessonSequenceEnabled
     * @request GET:/api/course/lesson-sequence-enabled/{courseId}
     */
    courseControllerGetLessonSequenceEnabled: (courseId: string, params: RequestParams = {}) =>
      this.request<GetLessonSequenceEnabledResponse, any>({
        path: `/api/course/lesson-sequence-enabled/${courseId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerEnrollCourse
     * @request POST:/api/course/enroll-course
     */
    courseControllerEnrollCourse: (
      query?: {
        /** @format uuid */
        id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<EnrollCourseResponse, any>({
        path: `/api/course/enroll-course`,
        method: "POST",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerEnrollCourses
     * @request POST:/api/course/{courseId}/enroll-courses
     */
    courseControllerEnrollCourses: (
      courseId: string,
      data: EnrollCoursesBody,
      params: RequestParams = {},
    ) =>
      this.request<EnrollCoursesResponse, any>({
        path: `/api/course/${courseId}/enroll-courses`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerEnrollGroupsToCourse
     * @request POST:/api/course/{courseId}/enroll-groups-to-course
     */
    courseControllerEnrollGroupsToCourse: (
      courseId: string,
      data: EnrollGroupsToCourseBody,
      params: RequestParams = {},
    ) =>
      this.request<EnrollGroupsToCourseResponse, any>({
        path: `/api/course/${courseId}/enroll-groups-to-course`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerUnenrollGroupsFromCourse
     * @request DELETE:/api/course/{courseId}/unenroll-groups-from-course
     */
    courseControllerUnenrollGroupsFromCourse: (
      courseId: string,
      data: UnenrollGroupsFromCourseBody,
      params: RequestParams = {},
    ) =>
      this.request<UnenrollGroupsFromCourseResponse, any>({
        path: `/api/course/${courseId}/unenroll-groups-from-course`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerDeleteCourse
     * @request DELETE:/api/course/deleteCourse/{id}
     */
    courseControllerDeleteCourse: (id: string, params: RequestParams = {}) =>
      this.request<DeleteCourseResponse, any>({
        path: `/api/course/deleteCourse/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerDeleteManyCourses
     * @request DELETE:/api/course/deleteManyCourses
     */
    courseControllerDeleteManyCourses: (data: DeleteManyCoursesBody, params: RequestParams = {}) =>
      this.request<DeleteManyCoursesResponse, any>({
        path: `/api/course/deleteManyCourses`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerUnenrollCourses
     * @request DELETE:/api/course/unenroll-course
     */
    courseControllerUnenrollCourses: (
      query?: {
        /** @format uuid */
        courseId?: string;
        userIds?: string[];
      },
      params: RequestParams = {},
    ) =>
      this.request<UnenrollCoursesResponse, any>({
        path: `/api/course/unenroll-course`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetCourseStatistics
     * @request GET:/api/course/{courseId}/statistics
     */
    courseControllerGetCourseStatistics: (courseId: string, params: RequestParams = {}) =>
      this.request<GetCourseStatisticsResponse, any>({
        path: `/api/course/${courseId}/statistics`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetAverageQuizScores
     * @request GET:/api/course/{courseId}/statistics/average-quiz-score
     */
    courseControllerGetAverageQuizScores: (
      courseId: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAverageQuizScoresResponse, any>({
        path: `/api/course/${courseId}/statistics/average-quiz-score`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetCourseStudentsProgress
     * @request GET:/api/course/{courseId}/statistics/students-progress
     */
    courseControllerGetCourseStudentsProgress: (
      courseId: string,
      query?: {
        page?: number;
        perPage?: number;
        search?: string;
        sort?:
          | "studentName"
          | "completedLessonsCount"
          | "lastActivity"
          | "-studentName"
          | "-completedLessonsCount"
          | "-lastActivity";
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetCourseStudentsProgressResponse, any>({
        path: `/api/course/${courseId}/statistics/students-progress`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetCourseStudentsQuizResults
     * @request GET:/api/course/{courseId}/statistics/students-quiz-results
     */
    courseControllerGetCourseStudentsQuizResults: (
      courseId: string,
      query?: {
        page?: number;
        perPage?: number;
        quizId?: string;
        sort?:
          | "studentName"
          | "quizName"
          | "quizScore"
          | "attempts"
          | "lastAttempt"
          | "-studentName"
          | "-quizName"
          | "-quizScore"
          | "-attempts"
          | "-lastAttempt";
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetCourseStudentsQuizResultsResponse, any>({
        path: `/api/course/${courseId}/statistics/students-quiz-results`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerGetCourseStudentsAiMentorResults
     * @request GET:/api/course/{courseId}/statistics/students-ai-mentor-results
     */
    courseControllerGetCourseStudentsAiMentorResults: (
      courseId: string,
      query?: {
        page?: number;
        perPage?: number;
        lessonId?: string;
        sort?:
          | "studentName"
          | "lessonName"
          | "score"
          | "lastSession"
          | "-studentName"
          | "-lessonName"
          | "-score"
          | "-lastSession";
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetCourseStudentsAiMentorResultsResponse, any>({
        path: `/api/course/${courseId}/statistics/students-ai-mentor-results`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerCreateLanguage
     * @request POST:/api/course/beta-create-language/{courseId}
     */
    courseControllerCreateLanguage: (
      courseId: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/course/beta-create-language/${courseId}`,
        method: "POST",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @name CourseControllerDeleteLanguage
     * @request DELETE:/api/course/language/{courseId}
     */
    courseControllerDeleteLanguage: (
      courseId: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/course/language/${courseId}`,
        method: "DELETE",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @name ChapterControllerGetChapterWithLesson
     * @request GET:/api/chapter
     */
    chapterControllerGetChapterWithLesson: (
      query: {
        /** @format uuid */
        id: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetChapterWithLessonResponse, any>({
        path: `/api/chapter`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ChapterControllerUpdateChapter
     * @request PATCH:/api/chapter
     */
    chapterControllerUpdateChapter: (
      data: UpdateChapterBody,
      query?: {
        /** @format uuid */
        id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<UpdateChapterResponse, any>({
        path: `/api/chapter`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ChapterControllerRemoveChapter
     * @request DELETE:/api/chapter
     */
    chapterControllerRemoveChapter: (
      query: {
        /** @format uuid */
        chapterId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<RemoveChapterResponse, any>({
        path: `/api/chapter`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ChapterControllerBetaCreateChapter
     * @request POST:/api/chapter/beta-create-chapter
     */
    chapterControllerBetaCreateChapter: (data: BetaCreateChapterBody, params: RequestParams = {}) =>
      this.request<BetaCreateChapterResponse, any>({
        path: `/api/chapter/beta-create-chapter`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ChapterControllerUpdateChapterDisplayOrder
     * @request PATCH:/api/chapter/chapter-display-order
     */
    chapterControllerUpdateChapterDisplayOrder: (
      data: UpdateChapterDisplayOrderBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateChapterDisplayOrderResponse, any>({
        path: `/api/chapter/chapter-display-order`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ChapterControllerUpdateFreemiumStatus
     * @request PATCH:/api/chapter/freemium-status
     */
    chapterControllerUpdateFreemiumStatus: (
      data: UpdateFreemiumStatusBody,
      query?: {
        /** @format uuid */
        chapterId?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<UpdateFreemiumStatusResponse, any>({
        path: `/api/chapter/freemium-status`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerGetEnrolledLessons
     * @request GET:/api/lesson/student-lessons
     */
    lessonControllerGetEnrolledLessons: (
      query?: {
        title?: string;
        description?: string;
        searchQuery?: string;
        lessonCompleted?: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetEnrolledLessonsResponse, any>({
        path: `/api/lesson/student-lessons`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerGetLessonById
     * @request GET:/api/lesson/{id}
     */
    lessonControllerGetLessonById: (
      id: string,
      query: {
        /** @default "en" */
        language?: "en" | "pl";
        studentId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetLessonByIdResponse, any>({
        path: `/api/lesson/${id}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerBetaCreateLesson
     * @request POST:/api/lesson/beta-create-lesson
     */
    lessonControllerBetaCreateLesson: (data: BetaCreateLessonBody, params: RequestParams = {}) =>
      this.request<BetaCreateLessonResponse, any>({
        path: `/api/lesson/beta-create-lesson`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerBetaCreateAiMentorLesson
     * @request POST:/api/lesson/beta-create-lesson/ai
     */
    lessonControllerBetaCreateAiMentorLesson: (
      data: BetaCreateAiMentorLessonBody,
      params: RequestParams = {},
    ) =>
      this.request<BetaCreateAiMentorLessonResponse, any>({
        path: `/api/lesson/beta-create-lesson/ai`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerBetaUpdateAiMentorLesson
     * @request PATCH:/api/lesson/beta-update-lesson/ai
     */
    lessonControllerBetaUpdateAiMentorLesson: (
      data: BetaUpdateAiMentorLessonBody,
      query?: {
        /** @format uuid */
        id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BetaUpdateAiMentorLessonResponse, any>({
        path: `/api/lesson/beta-update-lesson/ai`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerBetaCreateQuizLesson
     * @request POST:/api/lesson/beta-create-lesson/quiz
     */
    lessonControllerBetaCreateQuizLesson: (
      data: BetaCreateQuizLessonBody,
      params: RequestParams = {},
    ) =>
      this.request<BetaCreateQuizLessonResponse, any>({
        path: `/api/lesson/beta-create-lesson/quiz`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerBetaUpdateQuizLesson
     * @request PATCH:/api/lesson/beta-update-lesson/quiz
     */
    lessonControllerBetaUpdateQuizLesson: (
      data: BetaUpdateQuizLessonBody,
      query?: {
        /** @format uuid */
        id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BetaUpdateQuizLessonResponse, any>({
        path: `/api/lesson/beta-update-lesson/quiz`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerBetaUpdateLesson
     * @request PATCH:/api/lesson/beta-update-lesson
     */
    lessonControllerBetaUpdateLesson: (
      data: BetaUpdateLessonBody,
      query?: {
        /** @format uuid */
        id?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<BetaUpdateLessonResponse, any>({
        path: `/api/lesson/beta-update-lesson`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerRemoveLesson
     * @request DELETE:/api/lesson
     */
    lessonControllerRemoveLesson: (
      query: {
        /** @format uuid */
        lessonId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<RemoveLessonResponse, any>({
        path: `/api/lesson`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerEvaluationQuiz
     * @request POST:/api/lesson/evaluation-quiz
     */
    lessonControllerEvaluationQuiz: (data: EvaluationQuizBody, params: RequestParams = {}) =>
      this.request<EvaluationQuizResponse, any>({
        path: `/api/lesson/evaluation-quiz`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerUploadImageToLesson
     * @request POST:/api/lesson/upload-files-to-lesson
     */
    lessonControllerUploadImageToLesson: (
      data: {
        /** @format uuid */
        lessonId: string;
        /** @format binary */
        file: File;
      },
      params: RequestParams = {},
    ) =>
      this.request<string, any>({
        path: `/api/lesson/upload-files-to-lesson`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerDeleteStudentQuizAnswers
     * @request DELETE:/api/lesson/delete-student-quiz-answers
     */
    lessonControllerDeleteStudentQuizAnswers: (
      query: {
        /** @format uuid */
        lessonId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<DeleteStudentQuizAnswersResponse, any>({
        path: `/api/lesson/delete-student-quiz-answers`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerCreateEmbedLesson
     * @request POST:/api/lesson/create-lesson/embed
     */
    lessonControllerCreateEmbedLesson: (data: CreateEmbedLessonBody, params: RequestParams = {}) =>
      this.request<CreateEmbedLessonResponse, any>({
        path: `/api/lesson/create-lesson/embed`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerUpdateEmbedLesson
     * @request PATCH:/api/lesson/update-lesson/embed/{id}
     */
    lessonControllerUpdateEmbedLesson: (
      id: string,
      data: UpdateEmbedLessonBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateEmbedLessonResponse, any>({
        path: `/api/lesson/update-lesson/embed/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerGetLessonImage
     * @request GET:/api/lesson/lesson-image/{resourceId}
     */
    lessonControllerGetLessonImage: (resourceId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/lesson/lesson-image/${resourceId}`,
        method: "GET",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerUploadAiMentorAvatar
     * @request POST:/api/lesson/ai-mentor/avatar
     */
    lessonControllerUploadAiMentorAvatar: (
      data: {
        /** @format uuid */
        lessonId: string;
        /** @format binary */
        file: File | null;
      },
      params: RequestParams = {},
    ) =>
      this.request<string, any>({
        path: `/api/lesson/ai-mentor/avatar`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name LessonControllerUpdateLessonDisplayOrder
     * @request PATCH:/api/lesson/update-lesson-display-order
     */
    lessonControllerUpdateLessonDisplayOrder: (
      data: UpdateLessonDisplayOrderBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateLessonDisplayOrderResponse, any>({
        path: `/api/lesson/update-lesson-display-order`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StudentLessonProgressControllerMarkLessonAsCompleted
     * @request POST:/api/studentLessonProgress
     */
    studentLessonProgressControllerMarkLessonAsCompleted: (
      query: {
        /** @format uuid */
        id: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<MarkLessonAsCompletedResponse, any>({
        path: `/api/studentLessonProgress`,
        method: "POST",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CertificatesControllerGetAllCertificates
     * @request GET:/api/certificates/all
     */
    certificatesControllerGetAllCertificates: (
      query?: {
        /** @format uuid */
        userId?: string;
        /** @default "en" */
        language?: "en" | "pl";
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAllCertificatesResponse, any>({
        path: `/api/certificates/all`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CertificatesControllerGetCertificate
     * @request GET:/api/certificates/certificate
     */
    certificatesControllerGetCertificate: (
      query?: {
        /** @format uuid */
        userId?: string;
        /** @format uuid */
        courseId?: string;
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetCertificateResponse, any>({
        path: `/api/certificates/certificate`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CertificatesControllerDownloadCertificate
     * @request POST:/api/certificates/download
     */
    certificatesControllerDownloadCertificate: (
      data: DownloadCertificateBody,
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/certificates/download`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name AiControllerGetThread
     * @request GET:/api/ai/thread
     */
    aiControllerGetThread: (
      query?: {
        /** @format uuid */
        thread?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetThreadResponse, any>({
        path: `/api/ai/thread`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AiControllerGetThreadMessages
     * @request GET:/api/ai/thread/messages
     */
    aiControllerGetThreadMessages: (
      query?: {
        /** @format uuid */
        thread?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetThreadMessagesResponse, any>({
        path: `/api/ai/thread/messages`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AiControllerStreamChat
     * @request POST:/api/ai/chat
     */
    aiControllerStreamChat: (data: StreamChatBody, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/ai/chat`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name AiControllerJudgeThread
     * @request POST:/api/ai/judge/{threadId}
     */
    aiControllerJudgeThread: (threadId: string, params: RequestParams = {}) =>
      this.request<JudgeThreadResponse, any>({
        path: `/api/ai/judge/${threadId}`,
        method: "POST",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AiControllerRetakeLesson
     * @request POST:/api/ai/retake/{lessonId}
     */
    aiControllerRetakeLesson: (lessonId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/ai/retake/${lessonId}`,
        method: "POST",
        ...params,
      }),

    /**
     * No description
     *
     * @name IngestionControllerIngest
     * @request POST:/api/ingestion/ingest
     */
    ingestionControllerIngest: (
      data: {
        /** @format uuid */
        lessonId: string;
        files: File[];
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/ingestion/ingest`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @name IngestionControllerGetAllAssignedDocumentsForLesson
     * @request GET:/api/ingestion/{lessonId}
     */
    ingestionControllerGetAllAssignedDocumentsForLesson: (
      lessonId: string,
      params: RequestParams = {},
    ) =>
      this.request<GetAllAssignedDocumentsForLessonResponse, any>({
        path: `/api/ingestion/${lessonId}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name IngestionControllerDeleteDocumentLink
     * @request DELETE:/api/ingestion/{documentLinkId}
     */
    ingestionControllerDeleteDocumentLink: (documentLinkId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/ingestion/${documentLinkId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeControllerCreatePaymentIntent
     * @request POST:/api/stripe
     */
    stripeControllerCreatePaymentIntent: (
      query: {
        amount: number;
        currency: string;
        customerId: string;
        courseId: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<CreatePaymentIntentResponse, any>({
        path: `/api/stripe`,
        method: "POST",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeControllerCreateCheckoutSession
     * @request POST:/api/stripe/checkout-session
     */
    stripeControllerCreateCheckoutSession: (
      data: CreateCheckoutSessionBody,
      params: RequestParams = {},
    ) =>
      this.request<CreateCheckoutSessionResponse, any>({
        path: `/api/stripe/checkout-session`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeWebhookControllerHandleWebhook
     * @request POST:/api/stripe/webhook
     */
    stripeWebhookControllerHandleWebhook: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/stripe/webhook`,
        method: "POST",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeControllerGetPromotionCodes
     * @request GET:/api/stripe/promotion-codes
     */
    stripeControllerGetPromotionCodes: (params: RequestParams = {}) =>
      this.request<GetPromotionCodesResponse, any>({
        path: `/api/stripe/promotion-codes`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeControllerGetPromotionCode
     * @request GET:/api/stripe/promotion-code/{id}
     */
    stripeControllerGetPromotionCode: (id: string, params: RequestParams = {}) =>
      this.request<GetPromotionCodeResponse, any>({
        path: `/api/stripe/promotion-code/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeControllerUpdatePromotionCode
     * @request PATCH:/api/stripe/promotion-code/{id}
     */
    stripeControllerUpdatePromotionCode: (
      id: string,
      data: UpdatePromotionCodeBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdatePromotionCodeResponse, any>({
        path: `/api/stripe/promotion-code/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name StripeControllerCreatePromotionCoupon
     * @request POST:/api/stripe/promotion-code
     */
    stripeControllerCreatePromotionCoupon: (
      data: CreatePromotionCouponBody,
      params: RequestParams = {},
    ) =>
      this.request<CreatePromotionCouponResponse, any>({
        path: `/api/stripe/promotion-code`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name HealthControllerCheck
     * @request GET:/api/healthcheck
     */
    healthControllerCheck: (params: RequestParams = {}) =>
      this.request<
        {
          /** @example "ok" */
          status?: string;
          /** @example {"database":{"status":"up"}} */
          info?: Record<
            string,
            {
              status: string;
              [key: string]: any;
            }
          >;
          /** @example {} */
          error?: Record<
            string,
            {
              status: string;
              [key: string]: any;
            }
          >;
          /** @example {"database":{"status":"up"}} */
          details?: Record<
            string,
            {
              status: string;
              [key: string]: any;
            }
          >;
        },
        {
          /** @example "error" */
          status?: string;
          /** @example {"database":{"status":"up"}} */
          info?: Record<
            string,
            {
              status: string;
              [key: string]: any;
            }
          >;
          /** @example {"redis":{"status":"down","message":"Could not connect"}} */
          error?: Record<
            string,
            {
              status: string;
              [key: string]: any;
            }
          >;
          /** @example {"database":{"status":"up"},"redis":{"status":"down","message":"Could not connect"}} */
          details?: Record<
            string,
            {
              status: string;
              [key: string]: any;
            }
          >;
        }
      >({
        path: `/api/healthcheck`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name TestConfigControllerSetup
     * @request POST:/api/test-config/setup
     */
    testConfigControllerSetup: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/test-config/setup`,
        method: "POST",
        ...params,
      }),

    /**
     * No description
     *
     * @name TestConfigControllerTeardown
     * @request POST:/api/test-config/teardown
     */
    testConfigControllerTeardown: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/test-config/teardown`,
        method: "POST",
        ...params,
      }),

    /**
     * No description
     *
     * @name CategoryControllerGetAllCategories
     * @request GET:/api/category
     */
    categoryControllerGetAllCategories: (
      query?: {
        title?: string;
        archived?: string;
        /** @min 1 */
        page?: number;
        perPage?: number;
        sort?: "title" | "creationDate" | "-title" | "-creationDate";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAllCategoriesResponse, any>({
        path: `/api/category`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CategoryControllerCreateCategory
     * @request POST:/api/category
     */
    categoryControllerCreateCategory: (data: CreateCategoryBody, params: RequestParams = {}) =>
      this.request<CreateCategoryResponse, any>({
        path: `/api/category`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CategoryControllerGetCategoryById
     * @request GET:/api/category/{id}
     */
    categoryControllerGetCategoryById: (id: string, params: RequestParams = {}) =>
      this.request<GetCategoryByIdResponse, any>({
        path: `/api/category/${id}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CategoryControllerUpdateCategory
     * @request PATCH:/api/category/{id}
     */
    categoryControllerUpdateCategory: (
      id: string,
      data: UpdateCategoryBody,
      params: RequestParams = {},
    ) =>
      this.request<UpdateCategoryResponse, any>({
        path: `/api/category/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CategoryControllerDeleteCategory
     * @request DELETE:/api/category/deleteCategory/{id}
     */
    categoryControllerDeleteCategory: (id: string, params: RequestParams = {}) =>
      this.request<DeleteCategoryResponse, any>({
        path: `/api/category/deleteCategory/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name CategoryControllerDeleteManyCategories
     * @request DELETE:/api/category/deleteManyCategories
     */
    categoryControllerDeleteManyCategories: (
      data: DeleteManyCategoriesBody,
      params: RequestParams = {},
    ) =>
      this.request<DeleteManyCategoriesResponse, any>({
        path: `/api/category/deleteManyCategories`,
        method: "DELETE",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ScormControllerUploadScormPackage
     * @request POST:/api/scorm/upload
     */
    scormControllerUploadScormPackage: (
      query: {
        courseId: string;
      },
      data: {
        /** @format binary */
        file?: File;
        /** Optional resource type */
        resource?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<UploadScormPackageResponse, any>({
        path: `/api/scorm/upload`,
        method: "POST",
        query: query,
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name ScormControllerServeScormContent
     * @request GET:/api/scorm/{courseId}/content
     */
    scormControllerServeScormContent: (
      courseId: string,
      query: {
        path: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/scorm/${courseId}/content`,
        method: "GET",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @name ScormControllerGetScormMetadata
     * @request GET:/api/scorm/{courseId}/metadata
     */
    scormControllerGetScormMetadata: (courseId: string, params: RequestParams = {}) =>
      this.request<GetScormMetadataResponse, any>({
        path: `/api/scorm/${courseId}/metadata`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AnnouncementsControllerGetAllAnnouncements
     * @request GET:/api/announcements
     */
    announcementsControllerGetAllAnnouncements: (params: RequestParams = {}) =>
      this.request<GetAllAnnouncementsResponse, any>({
        path: `/api/announcements`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AnnouncementsControllerCreateAnnouncement
     * @request POST:/api/announcements
     */
    announcementsControllerCreateAnnouncement: (
      data: CreateAnnouncementBody,
      params: RequestParams = {},
    ) =>
      this.request<CreateAnnouncementResponse, any>({
        path: `/api/announcements`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AnnouncementsControllerGetLatestUnreadAnnouncements
     * @request GET:/api/announcements/latest
     */
    announcementsControllerGetLatestUnreadAnnouncements: (params: RequestParams = {}) =>
      this.request<GetLatestUnreadAnnouncementsResponse, any>({
        path: `/api/announcements/latest`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AnnouncementsControllerGetUnreadAnnouncementsCount
     * @request GET:/api/announcements/unread
     */
    announcementsControllerGetUnreadAnnouncementsCount: (params: RequestParams = {}) =>
      this.request<GetUnreadAnnouncementsCountResponse, any>({
        path: `/api/announcements/unread`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AnnouncementsControllerGetAnnouncementsForUser
     * @request GET:/api/announcements/user/me
     */
    announcementsControllerGetAnnouncementsForUser: (
      query?: {
        title?: string;
        content?: string;
        authorName?: string;
        search?: string;
        isRead?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAnnouncementsForUserResponse, any>({
        path: `/api/announcements/user/me`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name AnnouncementsControllerMarkAnnouncementAsRead
     * @request PATCH:/api/announcements/{id}/read
     */
    announcementsControllerMarkAnnouncementAsRead: (id: string, params: RequestParams = {}) =>
      this.request<MarkAnnouncementAsReadResponse, any>({
        path: `/api/announcements/${id}/read`,
        method: "PATCH",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EnvControllerGetEnvKey
     * @request GET:/api/env/{envName}
     */
    envControllerGetEnvKey: (envName: string, params: RequestParams = {}) =>
      this.request<GetEnvKeyResponse, any>({
        path: `/api/env/${envName}`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EnvControllerBulkUpsertEnv
     * @request POST:/api/env/bulk
     */
    envControllerBulkUpsertEnv: (data: BulkUpsertEnvBody, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/env/bulk`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name EnvControllerGetFrontendSsoEnabled
     * @request GET:/api/env/frontend/sso
     */
    envControllerGetFrontendSsoEnabled: (params: RequestParams = {}) =>
      this.request<GetFrontendSSOEnabledResponse, any>({
        path: `/api/env/frontend/sso`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EnvControllerGetStripePublishableKey
     * @request GET:/api/env/stripe/publishable-key
     */
    envControllerGetStripePublishableKey: (params: RequestParams = {}) =>
      this.request<GetStripePublishableKeyResponse, any>({
        path: `/api/env/stripe/publishable-key`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EnvControllerGetStripeConfigured
     * @request GET:/api/env/frontend/stripe
     */
    envControllerGetStripeConfigured: (params: RequestParams = {}) =>
      this.request<GetStripeConfiguredResponse, any>({
        path: `/api/env/frontend/stripe`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name EnvControllerGetIsConfigSetup
     * @request GET:/api/env/config/setup
     */
    envControllerGetIsConfigSetup: (params: RequestParams = {}) =>
      this.request<GetIsConfigSetupResponse, any>({
        path: `/api/env/config/setup`,
        method: "GET",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerGetQa
     * @request GET:/api/qa/{qaId}
     */
    qaControllerGetQa: (
      qaId: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetQAResponse, any>({
        path: `/api/qa/${qaId}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerUpdateQa
     * @request PATCH:/api/qa/{qaId}
     */
    qaControllerUpdateQa: (
      qaId: string,
      data: UpdateQABody,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/qa/${qaId}`,
        method: "PATCH",
        query: query,
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerDeleteQa
     * @request DELETE:/api/qa/{qaId}
     */
    qaControllerDeleteQa: (qaId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/qa/${qaId}`,
        method: "DELETE",
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerGetAllQa
     * @request GET:/api/qa
     */
    qaControllerGetAllQa: (
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<GetAllQAResponse, any>({
        path: `/api/qa`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerCreateQa
     * @request POST:/api/qa
     */
    qaControllerCreateQa: (data: CreateQABody, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/qa`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerCreateLanguage
     * @request POST:/api/qa/create-language/{qaId}
     */
    qaControllerCreateLanguage: (
      qaId: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/qa/create-language/${qaId}`,
        method: "POST",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @name QaControllerDeleteLanguage
     * @request DELETE:/api/qa/language/{qaId}
     */
    qaControllerDeleteLanguage: (
      qaId: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/qa/language/${qaId}`,
        method: "DELETE",
        query: query,
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerGetDraftNewsList
     * @request GET:/api/news/drafts
     */
    newsControllerGetDraftNewsList: (
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
        /** @min 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetDraftNewsListResponse, any>({
        path: `/api/news/drafts`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerGetNews
     * @request GET:/api/news/{id}
     */
    newsControllerGetNews: (
      id: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
        isDraftMode?: boolean;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetNewsResponse, any>({
        path: `/api/news/${id}`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerUpdateNews
     * @request PATCH:/api/news/{id}
     */
    newsControllerUpdateNews: (id: string, data: UpdateNewsBody, params: RequestParams = {}) =>
      this.request<UpdateNewsResponse, any>({
        path: `/api/news/${id}`,
        method: "PATCH",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerAddNewLanguage
     * @summary Add a new language to a news item
     * @request POST:/api/news/{id}
     */
    newsControllerAddNewLanguage: (
      id: string,
      data: AddNewLanguageBody,
      params: RequestParams = {},
    ) =>
      this.request<AddNewLanguageResponse, any>({
        path: `/api/news/${id}`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerDeleteNews
     * @request DELETE:/api/news/{id}
     */
    newsControllerDeleteNews: (id: string, params: RequestParams = {}) =>
      this.request<DeleteNewsResponse, any>({
        path: `/api/news/${id}`,
        method: "DELETE",
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerGetNewsList
     * @request GET:/api/news
     */
    newsControllerGetNewsList: (
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
        /** @min 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<GetNewsListResponse, any>({
        path: `/api/news`,
        method: "GET",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerCreateNews
     * @request POST:/api/news
     */
    newsControllerCreateNews: (data: CreateNewsBody, params: RequestParams = {}) =>
      this.request<CreateNewsResponse, any>({
        path: `/api/news`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerDeleteNewsLanguage
     * @request DELETE:/api/news/{id}/language
     */
    newsControllerDeleteNewsLanguage: (
      id: string,
      query?: {
        /** @default "en" */
        language?: "en" | "pl";
      },
      params: RequestParams = {},
    ) =>
      this.request<DeleteNewsLanguageResponse, any>({
        path: `/api/news/${id}/language`,
        method: "DELETE",
        query: query,
        format: "json",
        ...params,
      }),

    /**
     * No description
     *
     * @name NewsControllerUploadFileToNews
     * @request POST:/api/news/{id}/upload
     */
    newsControllerUploadFileToNews: (
      id: string,
      data: {
        /** @format binary */
        file: File;
        language: "en" | "pl";
        title: string;
        description: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<UploadFileToNewsResponse, any>({
        path: `/api/news/${id}/upload`,
        method: "POST",
        body: data,
        type: ContentType.FormData,
        format: "json",
        ...params,
      }),
  };
}
