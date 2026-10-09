
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "channels": {
                  Row: {
                    "archived_at": string | null,"description": string | null,"id": string,"name": string,"position": number,"program": Database["public"]['Enums']["program"] | null,"slug": string,"type": Database["public"]['Enums']["channel_type"]
                  }
                  Insert: {
                    "archived_at"?: string | null,"description"?: string | null,"id"?: string,"name": string,"position"?: number,"program"?: Database["public"]['Enums']["program"] | null,"slug": string,"type"?: Database["public"]['Enums']["channel_type"]
                  }
                  Update: {
                    "archived_at"?: string | null,"description"?: string | null,"id"?: string,"name"?: string,"position"?: number,"program"?: Database["public"]['Enums']["program"] | null,"slug"?: string,"type"?: Database["public"]['Enums']["channel_type"]
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"ends_at": string | null,"id": string,"link": string | null,"program": Database["public"]['Enums']["program"] | null,"starts_at": string,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"link"?: string | null,"program"?: Database["public"]['Enums']["program"] | null,"starts_at": string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"ends_at"?: string | null,"id"?: string,"link"?: string | null,"program"?: Database["public"]['Enums']["program"] | null,"starts_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"kb_articles": {
                  Row: {
                    "body_md": string,"category": Database["public"]['Enums']["ticket_category"] | null,"id": string,"program": Database["public"]['Enums']["program"] | null,"published": boolean | null,"search": unknown,"slug": string,"title": string,"updated_at": string | null
                  }
                  Insert: {
                    "body_md": string,"category"?: Database["public"]['Enums']["ticket_category"] | null,"id"?: string,"program"?: Database["public"]['Enums']["program"] | null,"published"?: boolean | null,"search"?: never,"slug": string,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "body_md"?: string,"category"?: Database["public"]['Enums']["ticket_category"] | null,"id"?: string,"program"?: Database["public"]['Enums']["program"] | null,"published"?: boolean | null,"search"?: never,"slug"?: string,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string | null,"current_period_end": string | null,"email": string,"grace_until": string | null,"id": string,"program": Database["public"]['Enums']["program"],"source": string,"status": Database["public"]['Enums']["membership_status"],"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"current_period_end"?: string | null,"email": string,"grace_until"?: string | null,"id"?: string,"program": Database["public"]['Enums']["program"],"source": string,"status": Database["public"]['Enums']["membership_status"],"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"current_period_end"?: string | null,"email"?: string,"grace_until"?: string | null,"id"?: string,"program"?: Database["public"]['Enums']["program"],"source"?: string,"status"?: Database["public"]['Enums']["membership_status"],"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "attachments": NonNullable<Json>,"author_id": string | null,"body": string,"channel_id": string | null,"created_at": string | null,"deleted_at": string | null,"edited_at": string | null,"id": string,"kind": string,"parent_id": string | null,"reply_count": number,"ticket_id": string | null,"via": string
                  }
                  Insert: {
                    "attachments"?: NonNullable<Json>,"author_id"?: string | null,"body": string,"channel_id"?: string | null,"created_at"?: string | null,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"kind"?: string,"parent_id"?: string | null,"reply_count"?: number,"ticket_id"?: string | null,"via"?: string
                  }
                  Update: {
                    "attachments"?: NonNullable<Json>,"author_id"?: string | null,"body"?: string,"channel_id"?: string | null,"created_at"?: string | null,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"kind"?: string,"parent_id"?: string | null,"reply_count"?: number,"ticket_id"?: string | null,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string | null,"id": string,"message_id": string | null,"read_at": string | null,"ticket_id": string | null,"type": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"message_id"?: string | null,"read_at"?: string | null,"ticket_id"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"message_id"?: string | null,"read_at"?: string | null,"ticket_id"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string | null,"created_at": string | null,"display_name": string,"email": string,"id": string,"notification_prefs": NonNullable<Json>,"role": Database["public"]['Enums']["user_role"],"timezone": string | null
                  }
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"display_name": string,"email": string,"id": string,"notification_prefs"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["user_role"],"timezone"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string | null,"created_at"?: string | null,"display_name"?: string,"email"?: string,"id"?: string,"notification_prefs"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["user_role"],"timezone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reactions": {
                  Row: {
                    "emoji": string,"message_id": string,"user_id": string
                  }
                  Insert: {
                    "emoji": string,"message_id": string,"user_id": string
                  }
                  Update: {
                    "emoji"?: string,"message_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reactions_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "messages"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reactions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"read_states": {
                  Row: {
                    "channel_id": string | null,"last_read_at": string,"ticket_id": string | null,"user_id": string
                  }
                  Insert: {
                    "channel_id"?: string | null,"last_read_at"?: string,"ticket_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "channel_id"?: string | null,"last_read_at"?: string,"ticket_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "read_states_channel_id_fkey"
      columns: ["channel_id"]
isOneToOne: false
      referencedRelation: "channels"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "read_states_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "read_states_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_replies": {
                  Row: {
                    "body": string,"created_by": string | null,"id": string,"title": string
                  }
                  Insert: {
                    "body": string,"created_by"?: string | null,"id"?: string,"title": string
                  }
                  Update: {
                    "body"?: string,"created_by"?: string | null,"id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_replies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stripe_price_map": {
                  Row: {
                    "program": Database["public"]['Enums']["program"],"stripe_price_id": string
                  }
                  Insert: {
                    "program": Database["public"]['Enums']["program"],"stripe_price_id": string
                  }
                  Update: {
                    "program"?: Database["public"]['Enums']["program"],"stripe_price_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"due_on": string | null,"id": string,"notes": string | null,"priority": Database["public"]['Enums']["ticket_priority"],"status": Database["public"]['Enums']["task_status"],"ticket_id": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_on"?: string | null,"id"?: string,"notes"?: string | null,"priority"?: Database["public"]['Enums']["ticket_priority"],"status"?: Database["public"]['Enums']["task_status"],"ticket_id"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_on"?: string | null,"id"?: string,"notes"?: string | null,"priority"?: Database["public"]['Enums']["ticket_priority"],"status"?: Database["public"]['Enums']["task_status"],"ticket_id"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "assignee_id": string | null,"category": Database["public"]['Enums']["ticket_category"],"created_at": string | null,"first_response_at": string | null,"id": string,"number": number,"priority": Database["public"]['Enums']["ticket_priority"],"program": Database["public"]['Enums']["program"],"requester_id": string,"resolved_at": string | null,"satisfaction": number | null,"status": Database["public"]['Enums']["ticket_status"],"subject": string,"updated_at": string | null
                  }
                  Insert: {
                    "assignee_id"?: string | null,"category": Database["public"]['Enums']["ticket_category"],"created_at"?: string | null,"first_response_at"?: string | null,"id"?: string,"number"?: number,"priority"?: Database["public"]['Enums']["ticket_priority"],"program": Database["public"]['Enums']["program"],"requester_id": string,"resolved_at"?: string | null,"satisfaction"?: number | null,"status"?: Database["public"]['Enums']["ticket_status"],"subject": string,"updated_at"?: string | null
                  }
                  Update: {
                    "assignee_id"?: string | null,"category"?: Database["public"]['Enums']["ticket_category"],"created_at"?: string | null,"first_response_at"?: string | null,"id"?: string,"number"?: number,"priority"?: Database["public"]['Enums']["ticket_priority"],"program"?: Database["public"]['Enums']["program"],"requester_id"?: string,"resolved_at"?: string | null,"satisfaction"?: number | null,"status"?: Database["public"]['Enums']["ticket_status"],"subject"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_requester_id_fkey"
      columns: ["requester_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_see_channel":
{ Args: { "cid": string }; Returns: boolean
                           },
"can_see_message":
{ Args: { "mid": string }; Returns: boolean
                           },
"can_see_ticket":
{ Args: { "tid": string }; Returns: boolean
                           },
"channel_unread_counts":
{ Args: Record<PropertyKey, never>; Returns: {
              "channel_id": string,"unread": number
            }[]
                           },
"has_any_access":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"has_program":
{ Args: { "p": Database["public"]['Enums']["program"] }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_channel_read":
{ Args: { "cid": string }; Returns: undefined
                           },
"open_ticket":
{ Args: { "p_body": string,"p_category": Database["public"]['Enums']["ticket_category"],"p_priority"?: Database["public"]['Enums']["ticket_priority"],"p_program": Database["public"]['Enums']["program"],"p_subject": string }; Returns: {
              "id": string,"number": number
            }[]
                           },
"rate_ticket":
{ Args: { "score": number,"tid": string }; Returns: undefined
                           }
          }
          Enums: {
            "channel_type": "text"|"announcement","membership_status": "active"|"past_due"|"canceled"|"manual","program": "alive_free"|"coachos","task_status": "todo"|"in_progress"|"done","ticket_category": "tech"|"website_domain"|"billing"|"coaching"|"other","ticket_priority": "normal"|"high"|"urgent","ticket_status": "new"|"open"|"waiting_on_client"|"resolved"|"closed","user_role": "member"|"agent"|"admin"|"owner"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "channel_type": ["text", "announcement"],"membership_status": ["active", "past_due", "canceled", "manual"],"program": ["alive_free", "coachos"],"task_status": ["todo", "in_progress", "done"],"ticket_category": ["tech", "website_domain", "billing", "coaching", "other"],"ticket_priority": ["normal", "high", "urgent"],"ticket_status": ["new", "open", "waiting_on_client", "resolved", "closed"],"user_role": ["member", "agent", "admin", "owner"]
          }
        }
} as const

