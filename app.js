import { db, storage, serverTimestamp } from "./firebase-config.js"
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js"

class ZiyoGram {
  constructor() {
    this.currentUser = null
    this.currentChat = null
    this.users = new Map()
    this.chats = new Map()
    this.messageListeners = new Map()
    this.init()
  }

  init() {
    this.loadUserFromStorage()
    this.setupEventListeners()
    this.showAppropriateScreen()
  }

  loadUserFromStorage() {
    const userData = localStorage.getItem("ziyogram_user")
    if (userData) {
      this.currentUser = JSON.parse(userData)
    }
  }

  saveUserToStorage() {
    localStorage.setItem("ziyogram_user", JSON.stringify(this.currentUser))
  }

  showAppropriateScreen() {
    if (this.currentUser) {
      this.showMainScreen()
    } else {
      this.showPhoneScreen()
    }
  }

  showPhoneScreen() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
    document.getElementById("phone-screen").classList.add("active")
  }

  showProfileScreen() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
    document.getElementById("profile-screen").classList.add("active")
  }

  showMainScreen() {
    document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"))
    document.getElementById("main-screen").classList.add("active")

    if (this.currentUser) {
      this.updateSidebarUserInfo()
      this.loadUsers()
      this.loadChats()
    }
  }

  setupEventListeners() {
    // Phone registration
    document.getElementById("next-btn").addEventListener("click", () => {
      this.handlePhoneSubmit()
    })

    // Profile setup
    document.getElementById("profile-image").addEventListener("change", (e) => {
      this.handleImageUpload(e)
    })

    document.querySelector(".profile-image-container").addEventListener("click", () => {
      document.getElementById("profile-image").click()
    })

    document.getElementById("start-messaging-btn").addEventListener("click", () => {
      this.handleProfileSubmit()
    })

    // Main screen
    document.getElementById("menu-btn").addEventListener("click", () => {
      this.toggleSidebar()
    })

    document.getElementById("sidebar-close").addEventListener("click", () => {
      this.closeSidebar()
    })

    // Message sending
    document.getElementById("send-btn").addEventListener("click", () => {
      this.sendMessage()
    })

    document.getElementById("message-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.sendMessage()
      }
    })

    // Search functionality
    document.getElementById("search-input").addEventListener("input", (e) => {
      this.handleSearch(e.target.value)
    })

    document.getElementById("clear-search").addEventListener("click", () => {
      this.clearSearch()
    })

    // Night mode toggle
    document.getElementById("night-mode-toggle").addEventListener("change", (e) => {
      this.toggleNightMode(e.target.checked)
    })
  }

  async handlePhoneSubmit() {
    const countryCode = document.getElementById("country-code").value
    const phoneNumber = document.getElementById("phone-number").value.trim()

    if (!phoneNumber) {
      alert("Iltimos, telefon raqamingizni kiriting / Please enter your phone number")
      return
    }

    const fullPhoneNumber = countryCode + phoneNumber

    const nextBtn = document.getElementById("next-btn")
    nextBtn.disabled = true
    nextBtn.textContent = "Checking..."

    try {
      const userQuery = query(collection(db, "users"), where("phone", "==", fullPhoneNumber))
      const userSnapshot = await getDocs(userQuery)

      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data()
        this.currentUser = {
          id: userSnapshot.docs[0].id,
          ...userData,
        }
        this.saveUserToStorage()
        this.showMainScreen()
      } else {
        this.tempPhone = fullPhoneNumber
        this.showProfileScreen()
      }
    } catch (error) {
      console.error("Error checking user:", error)
      alert("Xatolik yuz berdi. Qaytadan urinib ko'ring / Error occurred. Please try again.")
    } finally {
      nextBtn.disabled = false
      nextBtn.textContent = "Next"
    }
  }

  handleImageUpload(event) {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const preview = document.getElementById("profile-preview")
        const placeholder = document.getElementById("upload-placeholder")

        preview.src = e.target.result
        preview.style.display = "block"
        placeholder.style.display = "none"
      }
      reader.readAsDataURL(file)
    }
  }

  async handleProfileSubmit() {
    const firstName = document.getElementById("first-name").value.trim()
    const lastName = document.getElementById("last-name").value.trim()
    const imageFile = document.getElementById("profile-image").files[0]

    if (!firstName) {
      alert("Iltimos, ismingizni kiriting / Please enter your first name")
      return
    }

    const submitBtn = document.getElementById("start-messaging-btn")
    submitBtn.disabled = true
    submitBtn.textContent = "Creating account..."

    let profileImageUrl = ""

    if (imageFile) {
      try {
        const imageRef = ref(storage, `profile-images/${Date.now()}_${imageFile.name}`)
        const snapshot = await uploadBytes(imageRef, imageFile)
        profileImageUrl = await getDownloadURL(snapshot.ref)
      } catch (error) {
        console.error("Error uploading image:", error)
      }
    }

    const userData = {
      phone: this.tempPhone,
      firstName: firstName,
      lastName: lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      profileImage: profileImageUrl,
      createdAt: new Date(),
      lastSeen: new Date(),
      isOnline: true,
    }

    try {
      const docRef = await addDoc(collection(db, "users"), userData)
      this.currentUser = {
        id: docRef.id,
        ...userData,
      }
      this.saveUserToStorage()
      this.showMainScreen()
    } catch (error) {
      console.error("Error creating user:", error)
      alert("Xatolik yuz berdi. Qaytadan urinib ko'ring / Error creating account. Please try again.")
      submitBtn.disabled = false
      submitBtn.textContent = "Start Messaging"
    }
  }

  updateSidebarUserInfo() {
    if (this.currentUser) {
      const avatar = document.getElementById("sidebar-avatar")
      const name = document.getElementById("sidebar-name")

      if (this.currentUser.profileImage) {
        avatar.src = this.currentUser.profileImage
      } else {
        avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.fullName)}&background=0088cc&color=fff`
      }

      name.textContent = this.currentUser.fullName
    }
  }

  async loadUsers() {
    const usersQuery = query(collection(db, "users"))
    onSnapshot(usersQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const userData = { id: change.doc.id, ...change.doc.data() }
          this.users.set(change.doc.id, userData)

          if (userData.id !== this.currentUser.id) {
            this.addUserToChatList(userData)
          }
        }
      })
    })
  }

  async handleSearch(searchTerm) {
    const searchResults = document.getElementById("search-results")
    const searchList = document.getElementById("search-list")

    if (!searchTerm.trim()) {
      searchResults.style.display = "none"
      document.getElementById("chat-list").style.display = "block"
      return
    }

    searchResults.style.display = "block"
    document.getElementById("chat-list").style.display = "none"

    const phoneRegex = /^\+?[\d\s\-$$$$]+$/
    if (phoneRegex.test(searchTerm.trim())) {
      await this.searchByPhone(searchTerm.trim())
    } else {
      this.searchByName(searchTerm.trim())
    }
  }

  async searchByPhone(phoneNumber) {
    const searchList = document.getElementById("search-list")
    searchList.innerHTML = '<div class="loading" style="margin: 20px auto;"></div>'

    try {
      let normalizedPhone = phoneNumber.replace(/[\s\-$$$$]/g, "")
      if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+" + normalizedPhone
      }

      const userQuery = query(collection(db, "users"), where("phone", "==", normalizedPhone))
      const userSnapshot = await getDocs(userQuery)

      searchList.innerHTML = ""

      if (!userSnapshot.empty) {
        userSnapshot.forEach((doc) => {
          const userData = { id: doc.id, ...doc.data() }
          if (userData.id !== this.currentUser.id) {
            this.addUserToSearchResults(userData)
          }
        })
      } else {
        searchList.innerHTML = `
                    <div style="padding: 20px; text-align: center; color: #8e8e93;">
                        No user found with this phone number
                    </div>
                `
      }
    } catch (error) {
      console.error("Error searching by phone:", error)
      searchList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #ff6b6b;">
                    Error searching. Please try again.
                </div>
            `
    }
  }

  searchByName(searchTerm) {
    const searchList = document.getElementById("search-list")
    searchList.innerHTML = ""

    const matchingUsers = Array.from(this.users.values()).filter(
      (user) => user.id !== this.currentUser.id && user.fullName.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    if (matchingUsers.length > 0) {
      matchingUsers.forEach((user) => {
        this.addUserToSearchResults(user)
      })
    } else {
      searchList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #8e8e93;">
                    No users found
                </div>
            `
    }
  }

  addUserToSearchResults(user) {
    const searchList = document.getElementById("search-list")
    const userItem = document.createElement("div")
    userItem.className = "chat-item"
    userItem.setAttribute("data-user-id", user.id)

    const avatarUrl =
      user.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0088cc&color=fff`

    userItem.innerHTML = `
            <div class="chat-item-avatar">
                <img src="${avatarUrl}" alt="${user.fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                ${user.isOnline ? '<div class="online-indicator"></div>' : ""}
            </div>
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <div class="chat-item-name">${user.fullName}</div>
                    <div class="chat-item-time">${user.isOnline ? "online" : "offline"}</div>
                </div>
                <div class="chat-item-message">${user.phone}</div>
            </div>
        `

    userItem.addEventListener("click", () => {
      this.clearSearch()
      this.openChat(user)
    })

    searchList.appendChild(userItem)
  }

  clearSearch() {
    document.getElementById("search-input").value = ""
    document.getElementById("search-results").style.display = "none"
    document.getElementById("chat-list").style.display = "block"
  }

  addUserToChatList(user) {
    const chatList = document.getElementById("chat-list")
    let chatItem = document.querySelector(`[data-user-id="${user.id}"]`)

    if (!chatItem) {
      chatItem = document.createElement("div")
      chatItem.className = "chat-item"
      chatItem.setAttribute("data-user-id", user.id)
      chatList.appendChild(chatItem)

      chatItem.addEventListener("click", () => {
        this.openChat(user)
      })
    }

    const avatarUrl =
      user.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0088cc&color=fff`

    chatItem.innerHTML = `
            <div class="chat-item-avatar">
                <img src="${avatarUrl}" alt="${user.fullName}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
                ${user.isOnline ? '<div class="online-indicator"></div>' : ""}
            </div>
            <div class="chat-item-content">
                <div class="chat-item-header">
                    <div class="chat-item-name">${user.fullName}</div>
                    <div class="chat-item-time">online</div>
                </div>
                <div class="chat-item-message">Click to start chatting</div>
            </div>
        `
  }

  openChat(user) {
    this.currentChat = user

    document.querySelectorAll(".chat-item").forEach((item) => item.classList.remove("active"))
    const activeItem = document.querySelector(`[data-user-id="${user.id}"]`)
    if (activeItem) activeItem.classList.add("active")

    document.querySelector(".empty-chat").style.display = "none"
    document.getElementById("active-chat").style.display = "flex"

    const chatAvatar = document.getElementById("chat-avatar")
    const chatName = document.getElementById("chat-name")
    const chatStatus = document.getElementById("chat-status")

    const avatarUrl =
      user.profileImage ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName)}&background=0088cc&color=fff`

    chatAvatar.src = avatarUrl
    chatName.textContent = user.fullName
    chatStatus.textContent = user.isOnline ? "online" : "last seen recently"

    this.loadMessages(user.id)

    if (window.innerWidth <= 768) {
      document.querySelector(".chat-area").classList.add("mobile-active")
    }
  }

  async loadMessages(userId) {
    const messagesContainer = document.getElementById("messages-container")
    messagesContainer.innerHTML = ""

    const chatId = [this.currentUser.id, userId].sort().join("_")

    if (this.messageListeners.has(chatId)) {
      this.messageListeners.get(chatId)()
    }

    const messagesQuery = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"))

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      let lastDate = null

      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const messageData = { id: change.doc.id, ...change.doc.data() }
          this.addMessageToUI(messageData, lastDate)

          if (messageData.timestamp) {
            lastDate = new Date(messageData.timestamp.seconds * 1000).toDateString()
          }
        }
      })

      messagesContainer.scrollTop = messagesContainer.scrollHeight

      this.markMessagesAsRead(chatId, userId)
    })

    this.messageListeners.set(chatId, unsubscribe)
  }

  addMessageToUI(messageData, lastDate) {
    const messagesContainer = document.getElementById("messages-container")
    const messageDiv = document.createElement("div")

    if (messageData.timestamp) {
      const messageDate = new Date(messageData.timestamp.seconds * 1000).toDateString()

      if (messageDate !== lastDate) {
        const dateSeparator = document.createElement("div")
        dateSeparator.className = "date-separator"
        dateSeparator.innerHTML = `<span>${this.formatDate(messageDate)}</span>`
        messagesContainer.appendChild(dateSeparator)
      }
    }

    const isOwn = messageData.senderId === this.currentUser.id
    messageDiv.className = `message ${isOwn ? "sent" : "received"}`

    const timestamp = messageData.timestamp
      ? new Date(messageData.timestamp.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    let statusHTML = ""
    if (isOwn) {
      if (messageData.read) {
        statusHTML = `
          <div class="message-status">
            <svg class="checkmark read" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
            <svg class="checkmark double read" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          </div>
        `
      } else if (messageData.delivered) {
        statusHTML = `
          <div class="message-status">
            <svg class="checkmark" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
            <svg class="checkmark double" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          </div>
        `
      } else {
        statusHTML = `
          <div class="message-status">
            <svg class="checkmark" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          </div>
        `
      }
    }

    messageDiv.innerHTML = `
      <div class="message-content">${messageData.text}</div>
      <div class="message-footer">
        <span class="message-time">${timestamp}</span>
        ${statusHTML}
      </div>
    `

    messagesContainer.appendChild(messageDiv)
  }

  formatDate(dateString) {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return "Today"
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    }
  }

  async markMessagesAsRead(chatId, senderId) {
    try {
      const messagesQuery = query(
        collection(db, "chats", chatId, "messages"),
        where("senderId", "==", senderId),
        where("read", "==", false),
      )

      const snapshot = await getDocs(messagesQuery)

      snapshot.forEach(async (messageDoc) => {
        await updateDoc(doc(db, "chats", chatId, "messages", messageDoc.id), {
          read: true,
          readAt: serverTimestamp(),
        })
      })
    } catch (error) {
      console.error("Error marking messages as read:", error)
    }
  }

  async sendMessage() {
    const messageInput = document.getElementById("message-input")
    const messageText = messageInput.value.trim()

    if (!messageText || !this.currentChat) return

    const chatId = [this.currentUser.id, this.currentChat.id].sort().join("_")

    const messageData = {
      text: messageText,
      senderId: this.currentUser.id,
      senderName: this.currentUser.fullName,
      receiverId: this.currentChat.id,
      timestamp: serverTimestamp(),
      chatId: chatId,
      delivered: true,
      read: false,
    }

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), messageData)
      messageInput.value = ""

      this.updateChatListLastMessage(this.currentChat.id, messageText)
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  updateChatListLastMessage(userId, lastMessage) {
    const chatItem = document.querySelector(`[data-user-id="${userId}"]`)
    if (chatItem) {
      const messageElement = chatItem.querySelector(".chat-item-message")
      const timeElement = chatItem.querySelector(".chat-item-time")

      if (messageElement) {
        messageElement.textContent = lastMessage
      }

      if (timeElement) {
        timeElement.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    }
  }

  loadChats() {
    // This would load existing chats/conversations
    // For now, we're showing all users as potential chats
  }

  toggleSidebar() {
    const sidebar = document.getElementById("sidebar")
    sidebar.classList.toggle("open")
  }

  closeSidebar() {
    const sidebar = document.getElementById("sidebar")
    sidebar.classList.remove("open")
  }

  toggleNightMode(enabled) {
    console.log("Night mode:", enabled)
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ZiyoGram()
})
