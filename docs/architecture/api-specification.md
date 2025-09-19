# API Specification

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: Zanari API
  version: 1.0.0
  description: API for Zanari automated savings application
  contact:
    name: Zanari Development Team
    email: dev@zanari.com

servers:
  - url: https://api.zanari.com/v1
    description: Production server
  - url: https://dev-api.zanari.com/v1
    description: Development server

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        phone_number:
          type: string
        first_name:
          type: string
        last_name:
          type: string
        email:
          type: string
        kyc_status:
          type: string
          enum: [pending, verified, rejected]
        is_active:
          type: boolean
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Wallet:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        balance:
          type: number
          format: decimal
        currency:
          type: string
          default: KES
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    SavingsGoal:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        name:
          type: string
        description:
          type: string
        target_amount:
          type: number
          format: decimal
        current_amount:
          type: number
          format: decimal
        target_date:
          type: string
          format: date
        icon_emoji:
          type: string
        status:
          type: string
          enum: [active, completed, paused]
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Transaction:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        wallet_id:
          type: string
          format: uuid
        type:
          type: string
          enum: [deposit, withdrawal, savings, refund]
        amount:
          type: number
          format: decimal
        currency:
          type: string
          default: KES
        description:
          type: string
        reference_number:
          type: string
        status:
          type: string
          enum: [pending, completed, failed]
        savings_goal_id:
          type: string
          format: uuid
        mpesa_transaction_id:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    MpesaAccount:
      type: object
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        phone_number:
          type: string
        account_name:
          type: string
        is_active:
          type: boolean
        is_default:
          type: boolean
        round_up_enabled:
          type: boolean
        round_up_amount:
          type: number
          format: decimal
        daily_limit:
          type: number
          format: decimal
        last_transaction_date:
          type: string
          format: date
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    ApiResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: object
        meta:
          type: object
          properties:
            timestamp:
              type: string
              format: date-time
            request_id:
              type: string
              format: uuid

paths:
  # Authentication endpoints
  /auth/register:
    post:
      summary: Register new user
      tags: [Authentication]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                phone_number:
                  type: string
                  example: "+254712345678"
                pin:
                  type: string
                  example: "1234"
                first_name:
                  type: string
                  example: "John"
                last_name:
                  type: string
                  example: "Doe"
                email:
                  type: string
                  example: "john.doe@example.com"
              required:
                - phone_number
                - pin
                - first_name
                - last_name
      responses:
        '201':
          description: User registered successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/User'
        '400':
          description: Invalid request data
        '409':
          description: User already exists

  /auth/login:
    post:
      summary: Login user
      tags: [Authentication]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                phone_number:
                  type: string
                  example: "+254712345678"
                pin:
                  type: string
                  example: "1234"
              required:
                - phone_number
                - pin
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          user:
                            $ref: '#/components/schemas/User'
                          access_token:
                            type: string
                          refresh_token:
                            type: string
        '401':
          description: Invalid credentials
        '423':
          description: Account locked

  /auth/logout:
    post:
      summary: Logout user
      tags: [Authentication]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Logout successful
        '401':
          description: Unauthorized

  # Wallet endpoints
  /wallet:
    get:
      summary: Get user wallet
      tags: [Wallet]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Wallet retrieved successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/Wallet'
        '404':
          description: Wallet not found

  # Savings goals endpoints
  /goals:
    get:
      summary: Get user's savings goals
      tags: [Savings Goals]
      security:
        - BearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, completed, paused]
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Goals retrieved successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/SavingsGoal'
                      meta:
                        type: object
                        properties:
                          total:
                            type: integer
                          limit:
                            type: integer
                          offset:
                            type: integer

    post:
      summary: Create new savings goal
      tags: [Savings Goals]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  example: "New Phone"
                description:
                  type: string
                  example: "Save for a new smartphone"
                target_amount:
                  type: number
                  example: 50000
                target_date:
                  type: string
                  format: date
                  example: "2024-12-31"
                icon_emoji:
                  type: string
                  example: "📱"
              required:
                - name
                - target_amount
      responses:
        '201':
          description: Goal created successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/SavingsGoal'

  /goals/{goalId}:
    get:
      summary: Get specific savings goal
      tags: [Savings Goals]
      security:
        - BearerAuth: []
      parameters:
        - name: goalId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Goal retrieved successfully
        '404':
          description: Goal not found

    put:
      summary: Update savings goal
      tags: [Savings Goals]
      security:
        - BearerAuth: []
      parameters:
        - name: goalId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                description:
                  type: string
                target_amount:
                  type: number
                target_date:
                  type: string
                  format: date
                icon_emoji:
                  type: string
                status:
                  type: string
                  enum: [active, completed, paused]
      responses:
        '200':
          description: Goal updated successfully
        '404':
          description: Goal not found

    delete:
      summary: Delete savings goal
      tags: [Savings Goals]
      security:
        - BearerAuth: []
      parameters:
        - name: goalId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Goal deleted successfully
        '404':
          description: Goal not found

  # Goals funding endpoints
  /goals/{goalId}/fund:
    post:
      summary: Add funds to savings goal
      tags: [Savings Goals]
      security:
        - BearerAuth: []
      parameters:
        - name: goalId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                amount:
                  type: number
                  example: 1000
              required:
                - amount
      responses:
        '200':
          description: Funds added successfully
        '400':
          description: Invalid amount or insufficient funds
        '404':
          description: Goal not found

  # Transaction endpoints
  /transactions:
    get:
      summary: Get user transactions
      tags: [Transactions]
      security:
        - BearerAuth: []
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [deposit, withdrawal, savings, refund]
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, completed, failed]
        - name: start_date
          in: query
          schema:
            type: string
            format: date
        - name: end_date
          in: query
          schema:
            type: string
            format: date
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Transactions retrieved successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/Transaction'
                      meta:
                        type: object
                        properties:
                          total:
                            type: integer
                          limit:
                            type: integer
                          offset:
                            type: integer

  # M-PESA endpoints
  /mpesa/accounts:
    get:
      summary: Get user's M-PESA accounts
      tags: [M-PESA]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: M-PESA accounts retrieved successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/MpesaAccount'

    post:
      summary: Link M-PESA account
      tags: [M-PESA]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                phone_number:
                  type: string
                  example: "+254712345678"
              required:
                - phone_number
      responses:
        '201':
          description: M-PESA account linking initiated
        '400':
          description: Invalid phone number

  /mpesa/accounts/{accountId}:
    put:
      summary: Update M-PESA account settings
      tags: [M-PESA]
      security:
        - BearerAuth: []
      parameters:
        - name: accountId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                is_default:
                  type: boolean
                round_up_enabled:
                  type: boolean
                round_up_amount:
                  type: number
                daily_limit:
                  type: number
      responses:
        '200':
          description: Account updated successfully
        '404':
          description: Account not found

  # Analytics endpoints
  /analytics/savings:
    get:
      summary: Get savings analytics
      tags: [Analytics]
      security:
        - BearerAuth: []
      parameters:
        - name: period
          in: query
          schema:
            type: string
            enum: [7d, 30d, 90d, 1y]
            default: 30d
      responses:
        '200':
          description: Analytics retrieved successfully
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/ApiResponse'
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          total_saved:
                            type: number
                          monthly_average:
                            type: number
                          goals_completed:
                            type: integer
                          savings_trend:
                            type: array
                            items:
                              type: object
                              properties:
                                date:
                                  type: string
                                  format: date
                                amount:
                                  type: number

  # Webhook endpoints (external)
  /webhooks/mpesa:
    post:
      summary: M-PESA transaction webhook
      tags: [Webhooks]
      security:
        - ApiKeyAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                transaction_type:
                  type: string
                transaction_id:
                  type: string
                transaction_time:
                  type: string
                  format: date-time
                amount:
                  type: number
                phone_number:
                  type: string
                account_reference:
                  type: string
              required:
                - transaction_type
                - transaction_id
                - transaction_time
                - amount
                - phone_number
      responses:
        '200':
          description: Webhook processed successfully
        '400':
          description: Invalid webhook data
        '401':
          description: Invalid API key
```
