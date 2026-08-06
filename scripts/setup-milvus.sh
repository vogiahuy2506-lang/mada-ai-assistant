#!/bin/bash
# =============================================================================
# MADA AI - Milvus Vector Database Setup Script
# =============================================================================
# 
# Script này tự động setup Milvus Docker cho MADA AI Assistant
# 
# Usage:
#   ./scripts/setup-milvus.sh start     # Khởi động Milvus
#   ./scripts/setup-milvus.sh stop      # Dừng Milvus
#   ./scripts/setup-milvus.sh restart   # Restart Milvus
#   ./scripts/setup-milvus.sh status   # Kiểm tra trạng thái
#   ./scripts/setup-milvus.sh logs      # Xem logs
#   ./scripts/setup-milvus.sh remove    # Xóa hoàn toàn
#   ./scripts/setup-milvus.sh help      # Hiển thị trợ giúp
#
# YÊU CẦU:
#   - Docker Desktop đã cài đặt và đang chạy
#   - Ít nhất 4GB RAM available cho Docker
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config
MILVUS_VERSION="latest"
DATA_DIR="$(pwd)/volumes"
ETCD_DIR="${DATA_DIR}/etcd"
MINIO_DIR="${DATA_DIR}/minio"
MILVUS_DIR="${DATA_DIR}/milvus"

# Container names
ETCD_CONTAINER="mada-milvus-etcd"
MINIO_CONTAINER="mada-milvus-minio"
MILVUS_CONTAINER="mada-milvus-standalone"
ATTU_CONTAINER="mada-milvus-attu"

# Ports
ETCD_PORT=2379
MINIO_API_PORT=9001
MINIO_CONSOLE_PORT=9091
MILVUS_PORT=19530
MILVUS_CONSOLE_PORT=9091
ATTU_PORT=3000

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker không được cài đặt. Vui lòng cài đặt Docker Desktop trước."
        echo ""
        echo "Hướng dẫn cài đặt: https://docs.docker.com/desktop/install/mac-install/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker không đang chạy. Vui lòng khởi động Docker Desktop."
        exit 1
    fi

    log_success "Docker đã sẵn sàng"
}

create_directories() {
    log_info "Tạo thư mục cho Milvus data..."
    mkdir -p "${ETCD_DIR}"
    mkdir -p "${MINIO_DIR}"
    mkdir -p "${MILVUS_DIR}"
    log_success "Thư mục đã được tạo tại $(pwd)/volumes/"
}

start_etcd() {
    log_info "Khởi động etcd..."
    
    # Check if container already exists and running
    if docker ps --format '{{.Names}}' | grep -q "^${ETCD_CONTAINER}$"; then
        log_warn "Container ${ETCD_CONTAINER} đã đang chạy"
        return 0
    fi

    # Stop old container if exists
    docker stop ${ETCD_CONTAINER} 2>/dev/null || true
    docker rm ${ETCD_CONTAINER} 2>/dev/null || true

    # Start etcd
    docker run -d \
        --name ${ETCD_CONTAINER} \
        -p ${ETCD_PORT}:2379 \
        -v ${ETCD_DIR}:/etcd \
        milvusdb/etcd:${MILVUS_VERSION} \
        etcd -advertise-client-urls=http://127.0.0.1:2379 \
        etcd -listen-client-urls=http://0.0.0.0:2379 \
        --data-dir=/etcd

    # Wait for etcd to be ready
    sleep 3
    
    if docker ps --format '{{.Names}}' | grep -q "^${ETCD_CONTAINER}$"; then
        log_success "etcd đã khởi động thành công (port ${ETCD_PORT})"
    else
        log_error "Không thể khởi động etcd"
        exit 1
    fi
}

start_minio() {
    log_info "Khởi động MinIO..."
    
    # Check if container already exists and running
    if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
        log_warn "Container ${MINIO_CONTAINER} đã đang chạy"
        return 0
    fi

    # Stop old container if exists
    docker stop ${MINIO_CONTAINER} 2>/dev/null || true
    docker rm ${MINIO_CONTAINER} 2>/dev/null || true

    # Start MinIO
    docker run -d \
        --name ${MINIO_CONTAINER} \
        -p ${MINIO_API_PORT}:9001 \
        -p ${MINIO_CONSOLE_PORT}:9091 \
        -v ${MINIO_DIR}:/minio_data \
        minio/minio:${MILVUS_VERSION} \
        server /minio_data --console-address ":${MINIO_CONSOLE_PORT}" -address ":${MINIO_API_PORT}"

    # Wait for MinIO to be ready
    sleep 3
    
    if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
        log_success "MinIO đã khởi động thành công"
        log_info "  - MinIO API: http://localhost:${MINIO_API_PORT}"
        log_info "  - MinIO Console: http://localhost:${MINIO_CONSOLE_PORT}"
        log_info "  - Default credentials: minioadmin / minioadmin"
    else
        log_error "Không thể khởi động MinIO"
        exit 1
    fi
}

start_milvus() {
    log_info "Khởi động Milvus Standalone..."
    
    # Check if container already exists and running
    if docker ps --format '{{.Names}}' | grep -q "^${MILVUS_CONTAINER}$"; then
        log_warn "Container ${MILVUS_CONTAINER} đã đang chạy"
        return 0
    fi

    # Stop old container if exists
    docker stop ${MILVUS_CONTAINER} 2>/dev/null || true
    docker rm ${MILVUS_CONTAINER} 2>/dev/null || true

    # Start Milvus
    docker run -d \
        --name ${MILVUS_CONTAINER} \
        -p ${MILVUS_PORT}:19530 \
        -p ${MILVUS_CONSOLE_PORT}:9091 \
        -v ${MILVUS_DIR}:/var/lib/milvus \
        milvusdb/milvus:${MILVUS_VERSION} \
        milvus run standalone

    # Wait for Milvus to be ready
    log_info "Đợi Milvus khởi động..."
    sleep 10
    
    # Check health
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if curl -s http://localhost:${MILVUS_PORT}/healthz 2>/dev/null | grep -q "ok"; then
            log_success "Milvus đã khởi động thành công!"
            log_info "  - Milvus gRPC: localhost:${MILVUS_PORT}"
            log_info "  - Milvus Console: http://localhost:${MILVUS_CONSOLE_PORT}"
            return 0
        fi
        sleep 2
        attempts=$((attempts + 1))
    done

    log_error "Milvus không phản hồi health check sau 60 giây"
    log_info "Xem logs: ./scripts/setup-milvus.sh logs"
    exit 1
}

start_attu() {
    log_info "Khởi động Milvus Attu (Web UI)..."
    
    # Check if container already exists and running
    if docker ps --format '{{.Names}}' | grep -q "^${ATTU_CONTAINER}$"; then
        log_warn "Container ${ATTU_CONTAINER} đã đang chạy"
        return 0
    fi

    # Stop old container if exists
    docker stop ${ATTU_CONTAINER} 2>/dev/null || true
    docker rm ${ATTU_CONTAINER} 2>/dev/null || true

    # Start Attu
    docker run -d \
        --name ${ATTU_CONTAINER} \
        -p ${ATTU_PORT}:3000 \
        -e MILVUS_URL=http://localhost:${MILVUS_PORT} \
        zilliz/attu:latest

    log_success "Milvus Attu đã khởi động"
    log_info "  - Attu UI: http://localhost:${ATTU_PORT}"
}

stop_containers() {
    log_info "Dừng các container..."
    
    docker stop ${MILVUS_CONTAINER} 2>/dev/null || true
    docker stop ${MINIO_CONTAINER} 2>/dev/null || true
    docker stop ${ETCD_CONTAINER} 2>/dev/null || true
    docker stop ${ATTU_CONTAINER} 2>/dev/null || true
    
    log_success "Đã dừng các container"
}

remove_containers() {
    log_info "Xóa các container..."
    
    docker stop ${MILVUS_CONTAINER} 2>/dev/null || true
    docker stop ${MINIO_CONTAINER} 2>/dev/null || true
    docker stop ${ETCD_CONTAINER} 2>/dev/null || true
    docker stop ${ATTU_CONTAINER} 2>/dev/null || true
    
    docker rm ${MILVUS_CONTAINER} 2>/dev/null || true
    docker rm ${MINIO_CONTAINER} 2>/dev/null || true
    docker rm ${ETCD_CONTAINER} 2>/dev/null || true
    docker rm ${ATTU_CONTAINER} 2>/dev/null || true
    
    log_success "Đã xóa các container"
}

remove_data() {
    log_warn "Xóa tất cả data của Milvus..."
    read -p "Bạn có chắc muốn xóa data? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        rm -rf ${DATA_DIR}
        log_success "Đã xóa data"
    else
        log_info "Đã hủy"
    fi
}

show_status() {
    echo ""
    echo "=========================================="
    echo "        MILVUS STATUS"
    echo "=========================================="
    echo ""
    
    # Check each container
    for container in ${ETCD_CONTAINER} ${MINIO_CONTAINER} ${MILVUS_CONTAINER} ${ATTU_CONTAINER}; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            echo -e "${GREEN}✓${NC} ${container} - Running"
        elif docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
            echo -e "${YELLOW}○${NC} ${container} - Stopped"
        else
            echo -e "${RED}✗${NC} ${container} - Not created"
        fi
    done
    
    echo ""
    
    # Check Milvus health
    if curl -s http://localhost:${MILVUS_PORT}/healthz 2>/dev/null | grep -q "ok"; then
        echo -e "${GREEN}✓${NC} Milvus Health: OK"
    else
        echo -e "${RED}✗${NC} Milvus Health: Not responding"
    fi
    
    echo ""
    echo "Ports:"
    echo "  - etcd:         localhost:${ETCD_PORT}"
    echo "  - MinIO API:    localhost:${MINIO_API_PORT}"
    echo "  - MinIO Console: localhost:${MINIO_CONSOLE_PORT}"
    echo "  - Milvus gRPC:  localhost:${MILVUS_PORT}"
    echo "  - Milvus Console: localhost:${MILVUS_CONSOLE_PORT}"
    echo "  - Attu UI:     http://localhost:${ATTU_PORT}"
    echo ""
    echo "Data Directory: ${DATA_DIR}"
    echo ""
}

show_logs() {
    echo "=========================================="
    echo "        MILVUS LOGS"
    echo "=========================================="
    echo ""
    docker logs ${MILVUS_CONTAINER} --tail 50
}

show_help() {
    echo ""
    echo "=========================================="
    echo "     MADA AI - MILVUS SETUP SCRIPT"
    echo "=========================================="
    echo ""
    echo "Usage: ./scripts/setup-milvus.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start     Khởi động Milvus và các container liên quan"
    echo "  stop      Dừng tất cả các container"
    echo "  restart  Restart Milvus"
    echo "  status    Kiểm tra trạng thái các container"
    echo "  logs      Xem logs của Milvus"
    echo "  remove    Xóa tất cả các container (không xóa data)"
    echo "  purge     Xóa hoàn toàn container và data"
    echo "  help      Hiển thị trợ giúp này"
    echo ""
    echo "=========================================="
    echo ""
}

# Main
case "${1:-help}" in
    start)
        echo ""
        echo "=========================================="
        echo "     STARTING MILVUS"
        echo "=========================================="
        echo ""
        check_docker
        create_directories
        start_etcd
        start_minio
        start_milvus
        
        echo ""
        echo "=========================================="
        echo -e "     ${GREEN}MILVUS READY!${NC}"
        echo "=========================================="
        echo ""
        echo "Milvus đã sẵn sàng tại: localhost:${MILVUS_PORT}"
        echo ""
        echo "Tiếp theo:"
        echo "  1. Chạy migration: npm run milvus:migrate"
        echo "  2. Khởi động server: npm run server"
        echo ""
        ;;
    stop)
        echo ""
        echo "Stopping Milvus..."
        echo ""
        stop_containers
        echo ""
        log_success "Milvus đã được dừng"
        echo ""
        ;;
    restart)
        echo ""
        echo "Restarting Milvus..."
        echo ""
        stop_containers
        sleep 2
        start_etcd
        start_minio
        start_milvus
        echo ""
        log_success "Milvus đã restart"
        echo ""
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    remove)
        echo ""
        log_warn "Xóa containers (giữ lại data)..."
        remove_containers
        echo ""
        log_success "Đã xóa containers"
        echo ""
        ;;
    purge)
        echo ""
        log_warn "Xóa hoàn toàn Milvus..."
        remove_containers
        remove_data
        echo ""
        log_success "Đã xóa hoàn toàn Milvus"
        echo ""
        ;;
    help|*)
        show_help
        ;;
esac
